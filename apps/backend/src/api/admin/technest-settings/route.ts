import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { getTechnestSettings } from "../../../modules/settings/get-settings"
import { updateTechnestSettingsWorkflow } from "../../../workflows/update-technest-settings"
import type { AdminUpdateTechnestSettings } from "./middlewares"

/** GET /admin/technest-settings -> { settings } (every key, integer pence). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ settings: await getTechnestSettings(req.scope) })
}

/** POST /admin/technest-settings (partial) -> { settings } after the update. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateTechnestSettings>,
  res: MedusaResponse
) {
  await updateTechnestSettingsWorkflow(req.scope).run({ input: req.validatedBody })
  res.json({ settings: await getTechnestSettings(req.scope) })
}
