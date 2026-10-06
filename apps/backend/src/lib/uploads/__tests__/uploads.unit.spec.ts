import sharp from "sharp"
import { nameForImageType, sniffImageType } from "../image-type"
import { stripImageMetadata } from "../strip-metadata"

const WHERE = {
  IFD0: { Make: "PhoneMaker", Model: "Phone 15 Pro", Software: "CameraApp 9" },
  IFD3: {
    GPSLatitudeRef: "N",
    GPSLatitude: "51/1 29/1 3317/100",
    GPSLongitudeRef: "W",
    GPSLongitude: "0/1 3/1 4366/100",
  },
}

/** A photo with a gradient (so pixels differ) carrying phone and GPS details. */
function photo(orientation?: number) {
  const width = 64
  const height = 48
  const raw = Buffer.alloc(width * height * 3)
  for (let i = 0; i < width * height; i++) {
    raw[i * 3] = (i * 7) % 256
    raw[i * 3 + 1] = (i * 3) % 256
    raw[i * 3 + 2] = (i * 11) % 256
  }
  let image = sharp(raw, { raw: { width, height, channels: 3 } }).withExif(WHERE).withIccProfile("p3")
  if (orientation) {
    image = image.withMetadata({ orientation }).withExif(WHERE)
  }
  return image
}

const pixels = (file: Buffer) => sharp(file).raw().toBuffer()

/** What a reader would find: the bytes of the phone model and of the GPS reference. */
function leaks(file: Buffer) {
  const text = file.toString("latin1")
  return ["PhoneMaker", "Phone 15 Pro", "CameraApp"].filter((s) => text.includes(s))
}

describe("sniffImageType", () => {
  it("recognises the four image types by content", async () => {
    expect(sniffImageType(await photo().jpeg().toBuffer())).toBe("image/jpeg")
    expect(sniffImageType(await photo().png().toBuffer())).toBe("image/png")
    expect(sniffImageType(await photo().webp().toBuffer())).toBe("image/webp")
    expect(sniffImageType(await photo().gif().toBuffer())).toBe("image/gif")
  })

  it("refuses everything else whatever it is called", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    const html = Buffer.from("<!doctype html><script>alert(1)</script>")
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic\0\0\0\0mif1heic")])
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom\0\0\0\0isomiso2")])
    const pdf = Buffer.from("%PDF-1.7\n")
    for (const file of [svg, html, heic, mp4, pdf, Buffer.alloc(0), Buffer.from("RIFF1234WAVE")]) {
      expect(sniffImageType(file)).toBeNull()
    }
  })
})

describe("nameForImageType", () => {
  it("keeps a matching extension and replaces a wrong one", () => {
    expect(nameForImageType("IMG_0042.JPG", "image/jpeg")).toBe("IMG_0042.JPG")
    expect(nameForImageType("photo.jpeg", "image/jpeg")).toBe("photo.jpeg")
    expect(nameForImageType("page.html", "image/jpeg")).toBe("page.jpg")
    expect(nameForImageType("drawing.svg", "image/png")).toBe("drawing.png")
    expect(nameForImageType("noext", "image/webp")).toBe("noext.webp")
    expect(nameForImageType("", "image/gif")).toBe("upload.gif")
    expect(nameForImageType("../../etc/passwd", "image/png")).toBe("..-..-etc-passwd.png")
  })
})

describe("stripImageMetadata", () => {
  const formats = [
    ["image/jpeg", (o?: number) => photo(o).jpeg({ quality: 90 }).toBuffer()],
    ["image/png", (o?: number) => photo(o).png().toBuffer()],
    ["image/webp", (o?: number) => photo(o).webp({ quality: 90 }).toBuffer()],
  ] as const

  it.each(formats)("%s: removes phone and location details, keeps the picture and its colour profile", async (type, make) => {
    const original = await make()
    expect(leaks(original)).toHaveLength(3)
    expect((await sharp(original).metadata()).exif).toBeDefined()

    const stripped = stripImageMetadata(original, type)

    expect(leaks(stripped)).toEqual([])
    const meta = await sharp(stripped).metadata()
    expect(meta.exif).toBeUndefined()
    expect(meta.xmp).toBeUndefined()
    expect(meta.icc).toBeDefined()
    expect(meta.width).toBe(64)
    expect(meta.height).toBe(48)
    expect((await pixels(stripped)).equals(await pixels(original))).toBe(true)
    expect(stripped.length).toBeLessThan(original.length)
  })

  it.each(formats)("%s: keeps the orientation so the photo is not shown on its side", async (type, make) => {
    const original = await make(6)
    expect((await sharp(original).metadata()).orientation).toBe(6)

    const stripped = stripImageMetadata(original, type)

    expect(leaks(stripped)).toEqual([])
    const meta = await sharp(stripped).metadata()
    expect(meta.orientation).toBe(6)
    // the EXIF block that remains holds the orientation and nothing else
    expect(meta.exif!.length).toBeLessThanOrEqual(32)
    expect((await pixels(stripped)).equals(await pixels(original))).toBe(true)
    // and the upright picture is the same one
    const upright = (f: Buffer) => sharp(f).rotate().raw().toBuffer()
    expect((await upright(stripped)).equals(await upright(original))).toBe(true)
  })

  it("drops whatever is appended after the end of a JPEG", async () => {
    const original = await photo().jpeg().toBuffer()
    const withTrailer = Buffer.concat([original, Buffer.from("ftypmp42 a video clip with a place name")])
    const stripped = stripImageMetadata(withTrailer, "image/jpeg")
    expect(stripped.toString("latin1")).not.toContain("place name")
    expect(stripped.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]))
    expect((await pixels(stripped)).equals(await pixels(original))).toBe(true)
  })

  it("handles progressive JPEGs (several scans)", async () => {
    const original = await photo(8).jpeg({ progressive: true }).toBuffer()
    const stripped = stripImageMetadata(original, "image/jpeg")
    expect(leaks(stripped)).toEqual([])
    expect((await sharp(stripped).metadata()).orientation).toBe(8)
    expect((await pixels(stripped)).equals(await pixels(original))).toBe(true)
  })

  it("leaves a file without metadata as the same picture", async () => {
    const plain = await sharp({ create: { width: 20, height: 10, channels: 4, background: "#12345680" } })
      .png()
      .toBuffer()
    const stripped = stripImageMetadata(plain, "image/png")
    expect((await pixels(stripped)).equals(await pixels(plain))).toBe(true)
    const lossless = await sharp(plain).webp({ lossless: true }).toBuffer()
    expect((await pixels(stripImageMetadata(lossless, "image/webp"))).equals(await pixels(lossless))).toBe(true)
  })

  it("throws on a truncated or damaged file instead of storing it", async () => {
    const jpeg = await photo().jpeg().toBuffer()
    expect(() => stripImageMetadata(jpeg.subarray(0, jpeg.length - 40), "image/jpeg")).toThrow()
    const png = await photo().png().toBuffer()
    expect(() => stripImageMetadata(png.subarray(0, png.length - 20), "image/png")).toThrow()
    expect(() => stripImageMetadata(Buffer.from("RIFF\0\0\0\0WEBP"), "image/webp")).toThrow()
  })

  it("returns a GIF unchanged", async () => {
    const gif = await photo().gif().toBuffer()
    expect(stripImageMetadata(gif, "image/gif")).toBe(gif)
  })
})
