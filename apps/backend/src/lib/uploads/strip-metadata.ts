import { crc32 } from "zlib"
import { UploadImageType } from "./image-type"

/**
 * Removes everything from an uploaded photo that describes where, when and
 * with what it was taken: EXIF (including GPS), XMP, IPTC, comments, maker
 * data and anything appended after the image (second images, video clips).
 *
 * The picture itself is not touched: the compressed image data is copied byte
 * for byte, together with the colour profile. The only EXIF value kept is the
 * orientation, because without it a phone photo would show on its side.
 *
 * Throws when the file's structure can't be read; callers treat that as
 * "not a usable image".
 */
export function stripImageMetadata(file: Buffer, type: UploadImageType): Buffer {
  switch (type) {
    case "image/jpeg":
      return stripJpeg(file)
    case "image/png":
      return stripPng(file)
    case "image/webp":
      return stripWebp(file)
    default:
      // GIF has no EXIF block.
      return file
  }
}

/** EXIF orientation (1-8) from a TIFF block, or 1 when absent or unreadable. */
export function readTiffOrientation(tiff: Buffer): number {
  try {
    if (tiff.length < 14) return 1
    const order = tiff.toString("latin1", 0, 2)
    if (order !== "II" && order !== "MM") return 1
    const le = order === "II"
    const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o))
    const u32 = (o: number) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o))
    if (u16(2) !== 42) return 1
    const ifd = u32(4)
    const count = u16(ifd)
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12
      if (u16(entry) === 0x0112) {
        const value = u16(entry + 8)
        return value >= 1 && value <= 8 ? value : 1
      }
    }
  } catch {
    // out-of-range offsets in a damaged block
  }
  return 1
}

/** A TIFF block holding nothing but the orientation. */
function orientationTiff(orientation: number): Buffer {
  return Buffer.from([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF, first IFD at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation, SHORT
    0x00, 0x00, 0x00, 0x00, // no further IFD
  ])
}

const EXIF_HEADER = Buffer.from("Exif\0\0", "latin1")

function damaged(): never {
  throw new Error("The image file is damaged")
}

function stripJpeg(file: Buffer): Buffer {
  const kept: Buffer[] = []
  let orientation = 1
  let pos = 2
  let sawScan = false

  while (pos < file.length) {
    if (file[pos] !== 0xff) damaged()
    // fill bytes before a marker
    while (file[pos + 1] === 0xff) pos++
    const marker = file[pos + 1]
    if (marker === undefined) damaged()

    if (marker === 0xd9) {
      if (!sawScan) damaged()
      // End of image: whatever follows is not part of the picture.
      return Buffer.concat([
        file.subarray(0, 2),
        ...(orientation !== 1 ? [jpegExifSegment(orientation)] : []),
        ...kept,
        Buffer.from([0xff, 0xd9]),
      ])
    }

    // Markers without a length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(file.subarray(pos, pos + 2))
      pos += 2
      continue
    }

    if (pos + 4 > file.length) damaged()
    const length = file.readUInt16BE(pos + 2)
    const end = pos + 2 + length
    if (length < 2 || end > file.length) damaged()
    const payload = file.subarray(pos + 4, end)

    if (marker === 0xda) {
      // Start of scan: header, then compressed data up to the next real marker.
      sawScan = true
      let scanEnd = end
      for (;;) {
        scanEnd = file.indexOf(0xff, scanEnd)
        if (scanEnd === -1 || scanEnd + 1 >= file.length) damaged()
        const next = file[scanEnd + 1]
        if (next === 0x00 || next === 0xff || (next >= 0xd0 && next <= 0xd7)) {
          scanEnd += next === 0xff ? 1 : 2
          continue
        }
        break
      }
      kept.push(file.subarray(pos, scanEnd))
      pos = scanEnd
      continue
    }

    const isApp = marker >= 0xe0 && marker <= 0xef
    if (marker === 0xe1 && payload.subarray(0, 6).equals(EXIF_HEADER)) {
      orientation = readTiffOrientation(payload.subarray(6))
    }
    const keep =
      !isApp && marker !== 0xfe // tables and frame headers; comments go
        ? true
        : marker === 0xe0 || // JFIF
          marker === 0xee || // Adobe colour transform, needed to decode
          (marker === 0xe2 && payload.toString("latin1", 0, 12) === "ICC_PROFILE\0")
    if (keep) {
      kept.push(file.subarray(pos, end))
    }
    pos = end
  }
  return damaged()
}

function jpegExifSegment(orientation: number): Buffer {
  const body = Buffer.concat([EXIF_HEADER, orientationTiff(orientation)])
  const head = Buffer.alloc(4)
  head.writeUInt16BE(0xffe1, 0)
  head.writeUInt16BE(body.length + 2, 2)
  return Buffer.concat([head, body])
}

/** PNG chunks that affect how the picture is drawn. Everything else is dropped. */
const PNG_KEEP = new Set([
  "IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT",
  "bKGD", "pHYs", "hIST", "sPLT", "cICP", "mDCV", "cLLI", "acTL", "fcTL", "fdAT",
])

function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, "latin1")
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0)
  return Buffer.concat([head, data, tail])
}

function stripPng(file: Buffer): Buffer {
  const kept: Buffer[] = [file.subarray(0, 8)]
  let orientation = 1
  let firstData = -1
  let pos = 8

  while (pos + 12 <= file.length) {
    const length = file.readUInt32BE(pos)
    const type = file.toString("latin1", pos + 4, pos + 8)
    const end = pos + 12 + length
    if (end > file.length) damaged()

    if (type === "eXIf") {
      orientation = readTiffOrientation(file.subarray(pos + 8, pos + 8 + length))
    }
    if (PNG_KEEP.has(type)) {
      if (type === "IDAT" && firstData === -1) firstData = kept.length
      kept.push(file.subarray(pos, end))
    }
    if (type === "IEND") {
      if (firstData === -1) damaged()
      if (orientation !== 1) {
        kept.splice(firstData, 0, pngChunk("eXIf", orientationTiff(orientation)))
      }
      return Buffer.concat(kept)
    }
    pos = end
  }
  return damaged()
}

/** WebP chunks that make up the picture. EXIF, XMP and unknown chunks are dropped. */
const WEBP_KEEP = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF", "ICCP"])
const WEBP_FLAG_EXIF = 0x08
const WEBP_FLAG_XMP = 0x04

function webpChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.write(type, 0, "latin1")
  head.writeUInt32LE(data.length, 4)
  return Buffer.concat([head, data, ...(data.length % 2 ? [Buffer.alloc(1)] : [])])
}

function stripWebp(file: Buffer): Buffer {
  const kept: Buffer[] = []
  let orientation = 1
  let header = -1
  let pos = 12

  while (pos + 8 <= file.length) {
    const type = file.toString("latin1", pos, pos + 4)
    const length = file.readUInt32LE(pos + 4)
    const end = pos + 8 + length + (length % 2)
    if (pos + 8 + length > file.length) damaged()

    if (type === "EXIF") {
      let tiff = file.subarray(pos + 8, pos + 8 + length)
      if (tiff.subarray(0, 6).equals(EXIF_HEADER)) tiff = tiff.subarray(6)
      orientation = readTiffOrientation(tiff)
    }
    if (WEBP_KEEP.has(type)) {
      if (type === "VP8X") header = kept.length
      kept.push(webpChunk(type, file.subarray(pos + 8, pos + 8 + length)))
    }
    pos = end
  }
  if (!kept.length) damaged()

  if (header !== -1) {
    // The header's flags say which optional chunks follow.
    const vp8x = Buffer.from(kept[header])
    vp8x[8] = vp8x[8] & ~WEBP_FLAG_XMP & ~WEBP_FLAG_EXIF
    if (orientation !== 1) {
      vp8x[8] |= WEBP_FLAG_EXIF
      kept.push(webpChunk("EXIF", orientationTiff(orientation)))
    }
    kept[header] = vp8x
  }

  const body = Buffer.concat(kept)
  const riff = Buffer.alloc(12)
  riff.write("RIFF", 0, "latin1")
  riff.writeUInt32LE(body.length + 4, 4)
  riff.write("WEBP", 8, "latin1")
  return Buffer.concat([riff, body])
}
