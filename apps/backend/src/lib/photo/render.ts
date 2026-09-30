import { MedusaError } from "@medusajs/framework/utils"
import sharp from "sharp"

/**
 * Deterministic product-photo rendering with sharp. Nothing here is generative:
 * the product's pixels come from the original photo and are only changed by
 * global per-channel gains (white balance and exposure, both clamped) and by
 * ordinary resampling to the output size. The worker's cut-out contributes
 * its alpha channel only. See docs/adr/0003-photo-pipeline.md.
 */

export const MIN_SHORT_SIDE = 1000
export const OUTPUT_SIZE = 2000
export const PADDING = 0.08
export const WORKER_MAX_SIDE = 2048

export const PHOTO_TOO_SMALL_MESSAGE = "Photo too small, please retake closer"
export const NO_PRODUCT_FOUND_MESSAGE =
  "No product found in the photo, please retake it against a plain background"
export const UNSUPPORTED_IMAGE_MESSAGE = "The file is not a supported image (use JPEG, PNG or WebP)"

/** Alpha at or above this counts as product when finding the crop box. */
const ALPHA_BOX_THRESHOLD = 24
/** Background pixels (for the white-balance reference) have alpha below this. */
const ALPHA_BACKGROUND = 8
/** Foreground pixels (for exposure) have alpha at or above this. */
const ALPHA_FOREGROUND = 224
/** White balance: each channel gain stays within +/-8%. */
const WB_MIN = 0.92
const WB_MAX = 1.08
/** Exposure: brighten only, at most +15%. Never darken (clipped highlights would go grey). */
const EXPOSURE_TARGET = 245
const EXPOSURE_MIN = 1
const EXPOSURE_MAX = 1.15
/** Shadow: black at this opacity, blurred, nudged down. */
const SHADOW_OPACITY = 0.22
const SHADOW_SIGMA = 18
const SHADOW_OFFSET_Y = 18

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function invalid(message: string) {
  return new MedusaError(MedusaError.Types.INVALID_DATA, message)
}

export type PreparedOriginal = {
  /** Size after EXIF rotation. */
  width: number
  height: number
  /** EXIF-rotated PNG, at most WORKER_MAX_SIDE on its longer side, to send to the worker. */
  workerInput: Buffer
}

async function orientedSize(input: Buffer) {
  let meta: sharp.Metadata
  try {
    meta = await sharp(input).metadata()
  } catch {
    throw invalid(UNSUPPORTED_IMAGE_MESSAGE)
  }
  if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) {
    throw invalid(UNSUPPORTED_IMAGE_MESSAGE)
  }
  const swapped = (meta.orientation ?? 1) >= 5
  return swapped
    ? { width: meta.height, height: meta.width }
    : { width: meta.width, height: meta.height }
}

/** Validates the original (type, minimum size) and builds the worker's input. */
export async function prepareOriginal(input: Buffer): Promise<PreparedOriginal> {
  const { width, height } = await orientedSize(input)
  if (Math.min(width, height) < MIN_SHORT_SIDE) {
    throw invalid(PHOTO_TOO_SMALL_MESSAGE)
  }
  const workerInput = await sharp(input)
    .rotate()
    .resize({ width: WORKER_MAX_SIDE, height: WORKER_MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 1 })
    .toBuffer()
  return { width, height, workerInput }
}

type Box = { left: number; top: number; width: number; height: number }

function alphaBox(alpha: Buffer, width: number, height: number): Box | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (alpha[row + x] >= ALPHA_BOX_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) {
    return null
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

export type Correction = {
  /** Per-channel multipliers applied to the product (white balance x exposure). */
  gains: [number, number, number]
  white_balance: [number, number, number]
  exposure: number
}

/**
 * Conservative global correction.
 * White balance: the removed backdrop is used as the neutral reference (shop
 * photos are taken on a plain, near-neutral surface); skipped when the backdrop
 * is too dark or clearly coloured. Exposure: lift the product's 99th-percentile
 * luminance towards EXPOSURE_TARGET, brighten only.
 */
export function computeCorrection(
  rgb: Buffer,
  alpha: Buffer,
  pixelCount: number
): Correction {
  const step = Math.max(1, Math.floor(pixelCount / 250_000))
  let bgR = 0
  let bgG = 0
  let bgB = 0
  let bgN = 0
  const fg: number[][] = []
  for (let p = 0; p < pixelCount; p += step) {
    const a = alpha[p]
    const i = p * 3
    if (a < ALPHA_BACKGROUND) {
      bgR += rgb[i]
      bgG += rgb[i + 1]
      bgB += rgb[i + 2]
      bgN++
    } else if (a >= ALPHA_FOREGROUND) {
      fg.push([rgb[i], rgb[i + 1], rgb[i + 2]])
    }
  }

  let wb: [number, number, number] = [1, 1, 1]
  const sampled = Math.ceil(pixelCount / step)
  if (bgN > sampled * 0.05) {
    const r = bgR / bgN
    const g = bgG / bgN
    const b = bgB / bgN
    const grey = (r + g + b) / 3
    const neutralEnough = Math.max(r, g, b) / Math.max(1, Math.min(r, g, b)) < 1.3
    if (grey > 60 && neutralEnough) {
      wb = [clamp(grey / r, WB_MIN, WB_MAX), clamp(grey / g, WB_MIN, WB_MAX), clamp(grey / b, WB_MIN, WB_MAX)]
    }
  }

  let exposure = 1
  if (fg.length > 100) {
    const lum = fg
      .map(([r, g, b]) => 0.2126 * r * wb[0] + 0.7152 * g * wb[1] + 0.0722 * b * wb[2])
      .sort((x, y) => x - y)
    const p99 = lum[Math.min(lum.length - 1, Math.floor(lum.length * 0.99))]
    if (p99 > 0) {
      exposure = clamp(EXPOSURE_TARGET / p99, EXPOSURE_MIN, EXPOSURE_MAX)
    }
  }

  return {
    gains: [wb[0] * exposure, wb[1] * exposure, wb[2] * exposure],
    white_balance: wb,
    exposure,
  }
}

export type RenderedPhoto = {
  webp: Buffer
  avif: Buffer
  width: number
  height: number
  correction: Correction
}

/**
 * original: the photo as uploaded. cutout: the worker's RGBA PNG (any size with
 * the same aspect ratio; only its alpha is used).
 */
export async function renderProductPhoto(original: Buffer, cutout: Buffer): Promise<RenderedPhoto> {
  const { data: rgb, info } = await sharp(original)
    .rotate()
    .toColourspace("srgb")
    .removeAlpha()
    .raw({ depth: "uchar" })
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info

  let alpha: Buffer
  try {
    alpha = await sharp(cutout)
      .ensureAlpha()
      .extractChannel(3)
      .resize(width, height, { fit: "fill" })
      .raw()
      .toBuffer()
  } catch {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "The photo worker returned an unreadable image")
  }

  const box = alphaBox(alpha, width, height)
  if (!box || box.width * box.height < width * height * 0.002) {
    throw invalid(NO_PRODUCT_FOUND_MESSAGE)
  }

  const correction = computeCorrection(rgb, alpha, width * height)
  const [gr, gg, gb] = correction.gains

  // Crop to the product and apply the global gains in one pass (RGBA).
  const product = Buffer.alloc(box.width * box.height * 4)
  for (let y = 0; y < box.height; y++) {
    const srcRow = (box.top + y) * width + box.left
    const dstRow = y * box.width
    for (let x = 0; x < box.width; x++) {
      const s = srcRow + x
      const si = s * 3
      const di = (dstRow + x) * 4
      product[di] = Math.min(255, Math.round(rgb[si] * gr))
      product[di + 1] = Math.min(255, Math.round(rgb[si + 1] * gg))
      product[di + 2] = Math.min(255, Math.round(rgb[si + 2] * gb))
      product[di + 3] = alpha[s]
    }
  }

  // Scale so the longer side fills the canvas minus 8% padding on each side.
  // Plain Lanczos resampling (sharp premultiplies alpha); no AI upscaling.
  const inner = Math.round(OUTPUT_SIZE * (1 - 2 * PADDING))
  const { data: scaled, info: scaledInfo } = await sharp(product, {
    raw: { width: box.width, height: box.height, channels: 4 },
  })
    .resize({ width: inner, height: inner, fit: "inside", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const pw = scaledInfo.width
  const ph = scaledInfo.height
  const left = Math.round((OUTPUT_SIZE - pw) / 2)
  const top = Math.round((OUTPUT_SIZE - ph) / 2)

  // Soft shadow: the product's silhouette in black at low opacity, blurred.
  const pad = Math.ceil(SHADOW_SIGMA * 3)
  const shadowRaw = Buffer.alloc(pw * ph * 4)
  for (let p = 0; p < pw * ph; p++) {
    shadowRaw[p * 4 + 3] = Math.round(scaled[p * 4 + 3] * SHADOW_OPACITY)
  }
  const shadow = await sharp(shadowRaw, { raw: { width: pw, height: ph, channels: 4 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(SHADOW_SIGMA)
    .png()
    .toBuffer()
  const productPng = await sharp(scaled, { raw: { width: pw, height: ph, channels: 4 } }).png().toBuffer()

  const flat = await sharp({
    create: { width: OUTPUT_SIZE, height: OUTPUT_SIZE, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      { input: shadow, left: left - pad, top: top - pad + SHADOW_OFFSET_Y },
      { input: productPng, left, top },
    ])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const canvas = () =>
    sharp(flat.data, { raw: { width: OUTPUT_SIZE, height: OUTPUT_SIZE, channels: flat.info.channels } })
  const [webp, avif] = await Promise.all([
    canvas().webp({ quality: 90, effort: 4 }).toBuffer(),
    canvas().avif({ quality: 60, effort: 2 }).toBuffer(),
  ])

  return { webp, avif, width: OUTPUT_SIZE, height: OUTPUT_SIZE, correction }
}
