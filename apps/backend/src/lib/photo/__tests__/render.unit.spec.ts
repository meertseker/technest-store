import sharp from "sharp"
import {
  MIN_SHORT_SIDE,
  NO_PRODUCT_FOUND_MESSAGE,
  OUTPUT_SIZE,
  PHOTO_TOO_LARGE_MESSAGE,
  PHOTO_TOO_SMALL_MESSAGE,
  PRODUCT_TOO_SMALL_MESSAGE,
  prepareOriginal,
  renderProductPhoto,
} from "../render"

jest.setTimeout(60_000)

type Rgb = [number, number, number]

/** A "phone photo": warm grey backdrop with a solid product rectangle. */
async function makePhoto(opts: {
  width: number
  height: number
  product: { left: number; top: number; width: number; height: number; colour: Rgb }
  backdrop?: Rgb
}) {
  const [r, g, b] = opts.backdrop ?? [228, 224, 214]
  const p = opts.product
  return sharp({ create: { width: opts.width, height: opts.height, channels: 3, background: { r, g, b } } })
    .composite([
      {
        input: {
          create: {
            width: p.width,
            height: p.height,
            channels: 3,
            background: { r: p.colour[0], g: p.colour[1], b: p.colour[2] },
          },
        },
        left: p.left,
        top: p.top,
      },
    ])
    .jpeg({ quality: 95 })
    .toBuffer()
}

/** What the worker returns: the photo with alpha = 255 on the product, 0 elsewhere. */
async function makeCutout(
  photo: Buffer,
  product: { left: number; top: number; width: number; height: number }
) {
  const { width, height } = await sharp(photo).metadata()
  const mask = await sharp({
    create: { width: width!, height: height!, channels: 3, background: "#000000" },
  })
    .composite([
      {
        input: { create: { width: product.width, height: product.height, channels: 3, background: "#ffffff" } },
        left: product.left,
        top: product.top,
      },
    ])
    .extractChannel(0)
    .png()
    .toBuffer()
  return sharp(photo).joinChannel(mask).png().toBuffer()
}

async function pixel(img: Buffer, x: number, y: number): Promise<Rgb> {
  const { data, info } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const i = (y * info.width + x) * info.channels
  return [data[i], data[i + 1], data[i + 2]]
}

/** Bounding box of pixels that are clearly not white (ignores the faint shadow). */
async function nonWhiteBox(img: Buffer) {
  const { data, info } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 3
      if (data[i] < 180 || data[i + 1] < 180 || data[i + 2] < 180) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return { minX, minY, maxX, maxY }
}

describe("photo render pipeline", () => {
  // Large enough that it is downscaled into the 2000 px canvas.
  const product = { left: 1000, top: 800, width: 2400, height: 1600, colour: [180, 30, 40] as Rgb }
  let photo: Buffer
  let cutout: Buffer

  beforeAll(async () => {
    photo = await makePhoto({ width: 4000, height: 3000, product })
    cutout = await makeCutout(photo, product)
  })

  describe("prepareOriginal", () => {
    it("accepts a photo whose shorter side is at least 1000px and returns a PNG for the worker", async () => {
      const prepared = await prepareOriginal(photo)
      expect(prepared).toMatchObject({ width: 4000, height: 3000 })
      const meta = await sharp(prepared.workerInput).metadata()
      expect(meta.format).toBe("png")
      expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2048)
    })

    it(`rejects a photo whose shorter side is under ${MIN_SHORT_SIDE}px`, async () => {
      const small = await makePhoto({
        width: 1600,
        height: 999,
        product: { left: 10, top: 10, width: 100, height: 100, colour: [0, 0, 0] },
      })
      await expect(prepareOriginal(small)).rejects.toThrow(PHOTO_TOO_SMALL_MESSAGE)
      expect(PHOTO_TOO_SMALL_MESSAGE).toBe("Photo too small, please retake closer")
    })

    it("checks the size after EXIF rotation (portrait phone photo)", async () => {
      const rotated = await sharp(photo).withMetadata({ orientation: 6 }).jpeg().toBuffer()
      const prepared = await prepareOriginal(rotated)
      expect(prepared).toMatchObject({ width: 3000, height: 4000 })
    })

    it("rejects photos over 50 megapixels before decoding them", async () => {
      const huge = await sharp({ create: { width: 8200, height: 6200, channels: 3, background: "#808080" } })
        .jpeg({ quality: 50 })
        .toBuffer()
      await expect(prepareOriginal(huge)).rejects.toThrow(PHOTO_TOO_LARGE_MESSAGE)
    })

    it("rejects data that is not an image", async () => {
      await expect(prepareOriginal(Buffer.from("not an image"))).rejects.toThrow(/not a supported image/i)
    })
  })

  describe("renderProductPhoto", () => {
    let webp: Buffer
    let avif: Buffer

    beforeAll(async () => {
      const out = await renderProductPhoto(photo, cutout)
      webp = out.webp
      avif = out.avif
    })

    it("outputs a 2000x2000 (1:1) WebP and AVIF", async () => {
      const w = await sharp(webp).metadata()
      expect(w).toMatchObject({ format: "webp", width: OUTPUT_SIZE, height: OUTPUT_SIZE })
      const a = await sharp(avif).metadata()
      expect(a.format).toBe("heif")
      expect(a).toMatchObject({ width: OUTPUT_SIZE, height: OUTPUT_SIZE })
      expect(OUTPUT_SIZE).toBe(2000)
    })

    it("has pure white corners and edges", async () => {
      for (const [x, y] of [
        [0, 0],
        [1999, 0],
        [0, 1999],
        [1999, 1999],
        [1000, 5],
        [5, 1000],
      ]) {
        const [r, g, b] = await pixel(webp, x, y)
        expect(Math.min(r, g, b)).toBeGreaterThanOrEqual(254)
      }
    })

    it("centres the product with 8% padding on its longer side", async () => {
      const box = await nonWhiteBox(webp)
      const pad = OUTPUT_SIZE * 0.08
      // Longer side (width) spans the canvas minus 8% each side (+/- resampling and shadow).
      expect(box.minX).toBeGreaterThanOrEqual(pad - 4)
      expect(box.minX).toBeLessThanOrEqual(pad + 4)
      expect(box.maxX).toBeGreaterThanOrEqual(OUTPUT_SIZE - pad - 5)
      expect(box.maxX).toBeLessThanOrEqual(OUTPUT_SIZE - pad + 4)
      // Shorter side is centred vertically.
      const centreY = (box.minY + box.maxY) / 2
      expect(Math.abs(centreY - OUTPUT_SIZE / 2)).toBeLessThanOrEqual(6)
      // Aspect ratio of the product is preserved (600x400).
      expect((box.maxX - box.minX) / (box.maxY - box.minY)).toBeCloseTo(1.5, 1)
    })

    it("keeps the product's colour unchanged (no correction by default)", async () => {
      const [r, g, b] = await pixel(webp, 1000, 1000)
      const [or, og, ob] = product.colour
      // Only lossy encoding noise: the product pixels are the original's.
      expect(Math.abs(r - or)).toBeLessThanOrEqual(4)
      expect(Math.abs(g - og)).toBeLessThanOrEqual(4)
      expect(Math.abs(b - ob)).toBeLessThanOrEqual(4)
    })

    it("can opt in to a clamped global correction", async () => {
      const out = await renderProductPhoto(photo, cutout, { colourCorrection: true })
      for (const gain of out.correction.gains) {
        expect(gain).toBeGreaterThanOrEqual(0.92)
        expect(gain).toBeLessThanOrEqual(1.08 * 1.15 + 1e-9)
      }
      const [r, g] = await pixel(out.webp, 1000, 1000)
      expect(r).toBeGreaterThan(g * 3) // still clearly red
    })

    it("draws a soft shadow below the product, not a hard edge", async () => {
      const box = await nonWhiteBox(webp)
      const [r, g, b] = await pixel(webp, 1000, box.maxY + 12)
      const shade = (r + g + b) / 3
      expect(shade).toBeLessThan(254)
      expect(shade).toBeGreaterThan(200)
    })

    it("uses only the cut-out's alpha: product colours come from the original", async () => {
      // A worker that returned altered RGB (e.g. all green) must not leak into the output.
      const { data, info } = await sharp(cutout).raw().toBuffer({ resolveWithObject: true })
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 0
        data[i + 1] = 255
        data[i + 2] = 0
      }
      const tampered = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png()
        .toBuffer()
      const out = await renderProductPhoto(photo, tampered)
      const [r, g] = await pixel(out.webp, 1000, 1000)
      expect(r).toBeGreaterThan(150)
      expect(g).toBeLessThan(60)
    })

    it("accepts a cut-out at a lower resolution than the original (mask is scaled up)", async () => {
      const small = await sharp(cutout).resize(2048, 1536).png().toBuffer()
      const out = await renderProductPhoto(photo, small)
      expect((await sharp(out.webp).metadata()).width).toBe(OUTPUT_SIZE)
    })

    it("never upscales a smaller product: the canvas shrinks around it at native size", async () => {
      const small = { left: 500, top: 300, width: 840, height: 420, colour: [30, 60, 170] as Rgb }
      const smallPhoto = await makePhoto({ width: 1600, height: 1200, product: small })
      const out = await renderProductPhoto(smallPhoto, await makeCutout(smallPhoto, small))
      // 840 px / (1 - 2 * 8%) = 1000 px canvas, product at 1:1.
      expect(out).toMatchObject({ width: 1000, height: 1000 })
      expect(await sharp(out.webp).metadata()).toMatchObject({ width: 1000, height: 1000 })
      const box = await nonWhiteBox(out.webp)
      expect(box.maxX - box.minX + 1).toBeGreaterThanOrEqual(838)
      expect(box.maxX - box.minX + 1).toBeLessThanOrEqual(842)
      const [r, g, b] = await pixel(out.webp, 500, 500)
      expect([r, g, b].map((v, i) => Math.abs(v - small.colour[i]) <= 4)).toEqual([true, true, true])
    })

    it("rejects a product that is too small in the frame", async () => {
      const tiny = { left: 700, top: 500, width: 300, height: 200, colour: [0, 0, 0] as Rgb }
      const tinyPhoto = await makePhoto({ width: 1600, height: 1200, product: tiny })
      await expect(renderProductPhoto(tinyPhoto, await makeCutout(tinyPhoto, tiny))).rejects.toThrow(
        PRODUCT_TOO_SMALL_MESSAGE
      )
    })

    it("rejects a cut-out with no product in it", async () => {
      const empty = await sharp(photo).ensureAlpha(0).png().toBuffer()
      await expect(renderProductPhoto(photo, empty)).rejects.toThrow(NO_PRODUCT_FOUND_MESSAGE)
    })
  })
})
