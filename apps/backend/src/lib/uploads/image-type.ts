export type UploadImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif"

export const UPLOAD_IMAGE_EXTENSIONS: Record<UploadImageType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * The image type a file really is, read from its first bytes. The name and the
 * content type a browser sends say nothing about the content, so they are never
 * used to decide what gets stored. Anything else (SVG, HTML, HEIC, PDF, video)
 * is `null`.
 */
export function sniffImageType(file: Buffer): UploadImageType | null {
  if (file.length >= 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff) {
    return "image/jpeg"
  }
  if (file.length >= 8 && file.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return "image/png"
  }
  if (
    file.length >= 12 &&
    file.toString("latin1", 0, 4) === "RIFF" &&
    file.toString("latin1", 8, 12) === "WEBP"
  ) {
    return "image/webp"
  }
  const gif = file.toString("latin1", 0, 6)
  if (gif === "GIF87a" || gif === "GIF89a") {
    return "image/gif"
  }
  return null
}

/** The file name with the extension that matches what the file really is. */
export function nameForImageType(filename: string, type: UploadImageType): string {
  const wanted = UPLOAD_IMAGE_EXTENSIONS[type]
  const base = (filename || "upload").replace(/[\\/]/g, "-")
  const ext = /\.[A-Za-z0-9]{1,5}$/.exec(base)?.[0] ?? ""
  const current = ext.toLowerCase()
  if (current === wanted || (type === "image/jpeg" && current === ".jpeg")) {
    return base
  }
  const stem = ext ? base.slice(0, -ext.length) : base
  return `${stem || "upload"}${wanted}`
}
