import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { collectStatusOf, CollectMeta, loadPickupOrder } from "../../../lib/click-collect"

export type PrepareReadyResendOutput = {
  /** Non-personal key that makes this resend its own email (once per press). */
  send_key: string
  patch: Record<string, unknown>
}

/** Only an order that is ready (not cancelled, not collected) can have its ready email resent. */
export const prepareReadyResendStep = createStep(
  "prepare-ready-resend",
  async ({ order_id }: { order_id: string }, { container }) => {
    const order = await loadPickupOrder(container, order_id)
    if (order.status === "canceled" || collectStatusOf(order.metadata) !== "ready") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Order ${order_id} is not waiting for collection: only a ready order's email can be resent`
      )
    }
    const at = new Date().toISOString()
    return new StepResponse<PrepareReadyResendOutput>({
      send_key: `resend:${at}`,
      patch: { [CollectMeta.READY_RESENT_AT]: at },
    })
  }
)
