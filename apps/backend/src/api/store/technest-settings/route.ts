import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getTechnestSettings } from "../../../modules/settings/get-settings"

/**
 * GET /store/technest-settings (publishable key) -> { settings }, every key in
 * integer pence. Cacheable for 60 s (docs/contracts/settings.md).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ settings: await getTechnestSettings(req.scope) })
}
