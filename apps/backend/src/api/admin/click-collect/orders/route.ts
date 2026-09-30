import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listClickCollectOrders } from "../../../../lib/click-collect/list"
import type { AdminGetClickCollectOrdersParams } from "../middlewares"

/** Click & Collect board column. See docs/contracts/click-collect.md. */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetClickCollectOrdersParams>,
  res: MedusaResponse
) {
  const { status, limit, offset } = req.validatedQuery
  const { orders, count } = await listClickCollectOrders(req.scope, { status, limit, offset })
  res.json({ orders, count, limit, offset })
}
