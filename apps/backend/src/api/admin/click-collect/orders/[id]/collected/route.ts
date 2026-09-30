import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  collectStatusOf,
  loadPickupOrder,
  paymentsOf,
  toClickCollectOrder,
} from "../../../../../../lib/click-collect"
import { markCollectedWorkflow } from "../../../../../../workflows/mark-collected"

const CLIENT_ERRORS = new Set<string>([
  MedusaError.Types.NOT_FOUND,
  MedusaError.Types.NOT_ALLOWED,
  MedusaError.Types.INVALID_DATA,
])

/** Customer has collected: capture, fulfil + deliver, emit technest.order.collected. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const orderId = req.params.id
  try {
    await markCollectedWorkflow(req.scope).run({
      input: { order_id: orderId, actor_id: req.auth_context?.actor_id },
    })
  } catch (e) {
    const error = e as { type?: string; message?: string }
    if (error.type && CLIENT_ERRORS.has(error.type)) throw e
    // Tell staff plainly when money was taken but the hand-over wasn't recorded.
    const order = await loadPickupOrder(req.scope, orderId).catch(() => null)
    const captured = !!order && paymentsOf(order).some((p) => p.captured_at)
    if (order && captured && collectStatusOf(order.metadata) !== "collected") {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Payment captured but the order could not be marked collected (${error.message}). ` +
          `Nothing was refunded. Press Collected again to retry.`
      )
    }
    throw e
  }
  const order = await loadPickupOrder(req.scope, orderId)
  res.json({ order: toClickCollectOrder(order) })
}
