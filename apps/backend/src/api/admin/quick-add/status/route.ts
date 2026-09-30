import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aiConfigured, QUICK_ADD_MODEL } from "../../../../lib/quick-add/claude"

/** GET /admin/quick-add/status: whether AI suggestions are available (never exposes the key). */
export async function GET(_req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const enabled = aiConfigured()
  res.json({
    ai_enabled: enabled,
    reason: enabled
      ? null
      : "AI suggestions are switched off (ANTHROPIC_API_KEY is not set). You can still add products by hand.",
    model: enabled ? QUICK_ADD_MODEL : null,
  })
}
