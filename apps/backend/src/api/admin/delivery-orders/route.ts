import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listDeliveryOrders } from "../../../lib/delivery/list"
import type { AdminGetDeliveryOrdersParams } from "./middlewares"

/** Delivery orders to pack, or shipped. See docs/contracts/delivery-orders.md. */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetDeliveryOrdersParams>,
  res: MedusaResponse
) {
  const { status, limit, offset } = req.validatedQuery
  const { orders, count } = await listDeliveryOrders(req.scope, { status, limit, offset })
  res.json({ orders, count, limit, offset })
}
