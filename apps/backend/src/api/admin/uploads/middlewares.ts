import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { nameForImageType, sniffImageType, UploadImageType } from "../../../lib/uploads/image-type"
import { stripImageMetadata } from "../../../lib/uploads/strip-metadata"

/** One upload request, all files together. Uploads are held in memory while they are stored. */
export const MAX_UPLOAD_REQUEST_BYTES = 30 * 1024 * 1024
export const MAX_UPLOAD_FILES = 10

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024))

type UploadedFile = { originalname: string; mimetype: string; buffer: Buffer; size: number }

/**
 * Checks one uploaded file and returns what may be stored: the type is read
 * from the content (not from the name or the browser's claim), and details of
 * where and with what a photo was taken are removed. Throws a 400 otherwise.
 */
export function cleanUploadedImage<T extends UploadedFile>(
  file: T,
  accepted: readonly UploadImageType[] = ["image/jpeg", "image/png", "image/webp", "image/gif"]
): T {
  const type = sniffImageType(file.buffer)
  if (!type || !accepted.includes(type)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `"${file.originalname || "The file"}" is not a supported image. Use ${accepted
        .map((t) => t.replace("image/", "").toUpperCase())
        .join(", ")}.`
    )
  }
  let buffer: Buffer
  try {
    buffer = stripImageMetadata(file.buffer, type)
  } catch {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `"${file.originalname || "The file"}" is damaged and can't be used. Take the photo again.`
    )
  }
  file.buffer = buffer
  file.size = buffer.length
  file.mimetype = type
  file.originalname = nameForImageType(file.originalname, type)
  return file
}

const isUploadPost = (req: MedusaRequest) =>
  req.method === "POST" && (req.path === "/" || req.path === "")

/**
 * Runs before Medusa reads the upload into memory: refuses a request whose
 * declared size is over the limit, or that does not declare one.
 */
export function limitUploadSize(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  if (!isUploadPost(req)) {
    return next()
  }
  const declared = Number(req.headers["content-length"])
  if (req.headers["transfer-encoding"] || !Number.isFinite(declared)) {
    req.resume()
    return next(new MedusaError(MedusaError.Types.INVALID_DATA, "The upload did not say how large it is."))
  }
  if (declared > MAX_UPLOAD_REQUEST_BYTES) {
    // Read and discard the body so the browser gets the answer instead of a broken connection.
    req.resume()
    return next(
      new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `The upload is larger than ${megabytes(MAX_UPLOAD_REQUEST_BYTES)} MB. Upload fewer or smaller photos.`
      )
    )
  }
  next()
}

/** Runs after Medusa has parsed the files and before they are stored. */
export function checkUploadedFiles(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const files = ((req as MedusaRequest & { files?: UploadedFile[] }).files ?? []) as UploadedFile[]
  if (files.length > MAX_UPLOAD_FILES) {
    return next(
      new MedusaError(MedusaError.Types.INVALID_DATA, `Upload at most ${MAX_UPLOAD_FILES} files at a time.`)
    )
  }
  try {
    files.forEach((file) => cleanUploadedImage(file))
  } catch (e) {
    return next(e)
  }
  next()
}

export const adminUploadMiddlewares: MiddlewareRoute[] = [
  // No `method`: registered ahead of Medusa's own upload parser for this path.
  { matcher: "/admin/uploads", middlewares: [limitUploadSize] },
  { method: ["POST"], matcher: "/admin/uploads", middlewares: [checkUploadedFiles] },
]
