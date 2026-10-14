import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { runOrConflict } from "../../../lib/lock-busy"
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
  await runOrConflict(
    () => updateTechnestSettingsWorkflow(req.scope).run({ input: req.validatedBody }),
    "The settings are being saved by another request. Try again in a moment."
  )
  res.json({ settings: await getTechnestSettings(req.scope) })
}
