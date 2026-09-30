import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  collectStatusOf,
  isLockBusyError,
  loadPickupOrder,
  paymentsOf,
  toClickCollectOrder,
} from "../../../../../../lib/click-collect"
import { markCollectedWorkflow } from "../../../../../../workflows/mark-collected"

/** Customer has collected: capture, fulfil + deliver, emit technest.order.collected. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const orderId = req.params.id
  try {
    await markCollectedWorkflow(req.scope).run({
      input: { order_id: orderId, actor_id: req.auth_context?.actor_id },
    })
  } catch (e) {
    if (isLockBusyError(e)) {
      // Another press is still capturing / fulfilling this order.
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Order ${orderId} is being updated. Refresh the board in a moment.`
      )
    }
    // Validation only passes for a ready, uncancelled order, and nothing but
    // this workflow captures a pickup order. So a captured payment on a ready,
    // uncancelled, uncollected order means a step after the capture failed.
    const order = await loadPickupOrder(req.scope, orderId).catch(() => null)
    if (
      order &&
      order.status !== "canceled" &&
      collectStatusOf(order.metadata) === "ready" &&
      paymentsOf(order).some((p) => p.captured_at)
    ) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Payment captured but the order could not be marked collected (${(e as Error).message}). ` +
          `Nothing was refunded. Press Collected again to retry.`
      )
    }
    throw e
  }
  const order = await loadPickupOrder(req.scope, orderId)
  res.json({ order: toClickCollectOrder(order) })
}
