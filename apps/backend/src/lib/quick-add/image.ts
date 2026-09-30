import sharp from "sharp"

/** Largest original we will read for analysis (same cap as the photo pipeline). */
export const MAX_ANALYZE_BYTES = 25 * 1024 * 1024
/** Refuse decompression bombs before sharp allocates them. */
export const MAX_ANALYZE_PIXELS = 50_000_000
/**
 * Claude downsizes anything larger than ~1568 px on the long edge anyway, so
 * sending more only costs upload time and tokens.
 */
export const CLAUDE_IMAGE_LONG_EDGE = 1568
/** The API's per-image limit is 5 MB of base64; a 1568 px JPEG is far below it. */
export const CLAUDE_IMAGE_MAX_BASE64 = 5 * 1024 * 1024

export class ImageTooLargeError extends Error {}
export class ImageUnreadableError extends Error {}

/**
 * EXIF-rotates and downsizes a photo to a JPEG for Claude. Never used for the
 * product image itself: the original stays untouched in file storage.
 */
export async function prepareImageForClaude(input: Buffer): Promise<{
  media_type: "image/jpeg"
  data: string
  width: number
  height: number
}> {
  if (input.length > MAX_ANALYZE_BYTES) {
    throw new ImageTooLargeError("Photo is larger than 25 MB")
  }
  let out: { data: Buffer; info: sharp.OutputInfo }
  try {
    out = await sharp(input, { limitInputPixels: MAX_ANALYZE_PIXELS })
      .rotate()
      .resize({
        width: CLAUDE_IMAGE_LONG_EDGE,
        height: CLAUDE_IMAGE_LONG_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer({ resolveWithObject: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : ""
    if (/pixel limit/i.test(message)) {
      throw new ImageTooLargeError("Photo has too many pixels (at most 50 megapixels)")
    }
    throw new ImageUnreadableError("The file is not a supported image (use JPEG, PNG or WebP)")
  }
  const data = out.data.toString("base64")
  if (data.length > CLAUDE_IMAGE_MAX_BASE64) {
    throw new ImageTooLargeError("Photo is too large to analyse")
  }
  return { media_type: "image/jpeg", data, width: out.info.width, height: out.info.height }
}
