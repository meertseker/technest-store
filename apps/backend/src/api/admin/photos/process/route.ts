import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { processProductPhotoWorkflow } from "../../../../workflows/process-product-photo"
import { AdminProcessPhoto } from "../middlewares"

type UploadRequest = AuthenticatedMedusaRequest<AdminProcessPhoto> & { file?: Express.Multer.File }

export async function POST(req: UploadRequest, res: MedusaResponse) {
  const started = Date.now()
  const { file_id, model } = req.validatedBody
  const upload = req.file
    ? {
        filename: req.file.originalname || "photo",
        mime_type: req.file.mimetype,
        content_base64: req.file.buffer.toString("base64"),
      }
    : undefined

  const { result } = await processProductPhotoWorkflow(req.scope).run({
    input: { file_id, upload, model },
  })

  res.json({
    ...result,
    timings_ms: { ...result.timings_ms, total: Date.now() - started },
  })
}
