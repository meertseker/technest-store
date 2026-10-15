import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { collectStatusOf, CollectMeta, loadPickupOrder } from "../../../lib/click-collect"

export type PrepareReadyResendOutput = {
  /** Non-personal key that makes this resend its own email (once per press). */
  send_key: string
  patch: Record<string, unknown>
}

/** Minimum time between two resends of the same order's ready email. */
export const READY_RESEND_COOLDOWN_MS = 10 * 60 * 1000

/** Thrown (as the error's message prefix) when a resend comes too soon after the last one. */
export const READY_RESEND_TOO_SOON = "ready-resend-too-soon"

export const isResendTooSoon = (e: unknown) =>
  typeof (e as { message?: unknown } | null)?.message === "string" &&
  (e as { message: string }).message.startsWith(READY_RESEND_TOO_SOON)

/**
 * Only an order that is ready (not cancelled, not collected) can have its
 * ready email resent, and not again within 10 minutes of the last resend.
 */
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
    const last = Date.parse(String((order.metadata ?? {})[CollectMeta.READY_RESENT_AT] ?? ""))
    if (Number.isFinite(last) && Date.now() - last < READY_RESEND_COOLDOWN_MS) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `${READY_RESEND_TOO_SOON}: the ready email of order ${order_id} was resent less than 10 minutes ago`
      )
    }
    const at = new Date().toISOString()
    return new StepResponse<PrepareReadyResendOutput>({
      send_key: `resend:${at}`,
      patch: { [CollectMeta.READY_RESENT_AT]: at },
    })
  }
)
