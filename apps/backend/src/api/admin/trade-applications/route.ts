import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listTradeApplicationDTOs } from "../../utils/trade"
import { AdminGetTradeApplicationsParams } from "./middlewares"

export async function GET(
  req: MedusaRequest<unknown, AdminGetTradeApplicationsParams>,
  res: MedusaResponse
) {
  const { status, limit, offset, order } = req.validatedQuery
  const { applications, count } = await listTradeApplicationDTOs(req.scope, {
    filters: status ? { status } : {},
    order,
    limit,
    offset,
  })
  res.json({ trade_applications: applications, count, limit, offset })
}
