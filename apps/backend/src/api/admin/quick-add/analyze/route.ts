import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { analyzeProductPhotoWorkflow } from "../../../../workflows/analyze-product-photo"
import { AdminQuickAddAnalyze } from "../middlewares"

const STATUS_BY_CODE = {
  ai_unavailable: 503,
  ai_timeout: 504,
  ai_refused: 422,
  ai_bad_response: 502,
} as const

/**
 * POST /admin/quick-add/analyze: a DRAFT listing suggested by Claude from an
 * uploaded photo (docs/contracts/quick-add.md). Writes nothing.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminQuickAddAnalyze>,
  res: MedusaResponse
) {
  const started = Date.now()
  const { result } = await analyzeProductPhotoWorkflow(req.scope).run({
    input: { file_id: req.validatedBody.file_id },
  })

  if (!result.ok) {
    res.status(STATUS_BY_CODE[result.code]).json({ type: result.code, message: result.message })
    return
  }
  res.json({
    suggestion: result.suggestion,
    original: result.original,
    model: result.model,
    timings_ms: { total: Date.now() - started },
  })
}
