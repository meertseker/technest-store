import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import multer from "multer"
import { PHOTO_MODELS } from "../../../modules/photo/providers/types"

export const MAX_PHOTO_BYTES = 25 * 1024 * 1024
export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]

/** multipart: `file` + optional `model`; JSON: `file_id` + optional `model`. */
export const AdminProcessPhoto = z.strictObject({
  file_id: z.string().trim().min(1).optional(),
  model: z.enum(PHOTO_MODELS).optional(),
})
export type AdminProcessPhoto = z.infer<typeof AdminProcessPhoto>

export const AdminApproveProductPhoto = z.strictObject({
  processed_file_id: z.string().trim().min(1),
  original_file_id: z.string().trim().min(1),
  processed_avif_file_id: z.string().trim().min(1).optional(),
  set_thumbnail: z.boolean().optional(),
})
export type AdminApproveProductPhoto = z.infer<typeof AdminApproveProductPhoto>

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 5 },
})

/** Parses a multipart upload (single `file`) and turns multer errors into 400s. */
export function parsePhotoUpload(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  upload.single("file")(req as any, res as any, (err?: unknown) => {
    if (!err) {
      return next()
    }
    const message =
      err instanceof multer.MulterError
        ? err.code === "LIMIT_FILE_SIZE"
          ? "Photo is larger than 25 MB"
          : `Invalid upload: ${err.message}`
        : "Invalid upload"
    next(new MedusaError(MedusaError.Types.INVALID_DATA, message))
  })
}

/** Exactly one of an uploaded `file` or a `file_id`, and only image types sharp can read. */
export function requirePhotoSource(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const file = (req as MedusaRequest & { file?: Express.Multer.File }).file
  const fileId = (req.validatedBody as AdminProcessPhoto | undefined)?.file_id
  if (!!file === !!fileId) {
    return next(
      new MedusaError(MedusaError.Types.INVALID_DATA, "Send either a photo as `file` (multipart) or a `file_id`")
    )
  }
  if (file && !ACCEPTED_PHOTO_TYPES.includes(file.mimetype)) {
    return next(
      new MedusaError(MedusaError.Types.INVALID_DATA, "The file is not a supported image (use JPEG, PNG or WebP)")
    )
  }
  next()
}

export const adminPhotoMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/photos/process",
    middlewares: [parsePhotoUpload, validateAndTransformBody(AdminProcessPhoto), requirePhotoSource],
  },
  {
    method: ["POST"],
    matcher: "/admin/products/:id/photos/approve",
    middlewares: [validateAndTransformBody(AdminApproveProductPhoto)],
  },
]
