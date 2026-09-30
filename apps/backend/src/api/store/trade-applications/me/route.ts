import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listTradeApplicationDTOs } from "../../../utils/trade"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { applications } = await listTradeApplicationDTOs(req.scope, {
    filters: { customer_id: req.auth_context.actor_id },
    order: "-created_at",
    limit: 1,
    offset: 0,
  })
  res.json({ trade_application: applications[0] ?? null })
}
