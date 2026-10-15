import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { CollectMeta } from "../../../lib/click-collect"
import { PaymentNoticeMeta } from "../../../lib/stripe-events/constants"

/** How long a cancel we started counts as still in flight. */
export const CANCEL_IN_FLIGHT_MS = 15 * 60 * 1000

export type PrepareHoldReleasedInput = {
  order_id: string
  payment_id: string
  payment_intent: string
  reason: string | null
  amount_pence: number
}

export type HoldReleasedState = "ours" | "order_cancelled" | "known" | "due"

export type PrepareHoldReleasedOutput = { state: HoldReleasedState; patch: Record<string, unknown> }

const result = (state: HoldReleasedState, patch: Record<string, unknown> = {}) =>
  new StepResponse<PrepareHoldReleasedOutput>({ state, patch })

/**
 * Re-reads the payment and the order under the order's lock and decides
 * whether a cancelled PaymentIntent was cancelled at Stripe (expired, or in
 * the dashboard) rather than by us. Medusa asks Stripe to cancel before it
 * marks the payment cancelled, and our own cancels hold this lock, so a
 * cancel of ours is visible here once the lock is ours. A cancel the
 * collection deadline started (marked before it calls Stripe) is ours too,
 * even if it hasn't finished.
 */
export const prepareHoldReleasedStep = createStep(
  "prepare-hold-released",
  async (input: PrepareHoldReleasedInput, { container }) => {
    const payment = await container
      .resolve(Modules.PAYMENT)
      .retrievePayment(input.payment_id, { select: ["id", "canceled_at"] })
    if (payment.canceled_at) return result("ours")
    const order = await container
      .resolve(Modules.ORDER)
      .retrieveOrder(input.order_id, { select: ["id", "status", "metadata"] })
    if (order.status === "canceled") return result("order_cancelled")

    const meta = (order.metadata ?? {}) as Record<string, unknown>
    const started = Date.parse(String(meta[CollectMeta.CANCEL_STARTED] ?? ""))
    if (Number.isFinite(started) && Date.now() - started < CANCEL_IN_FLIGHT_MS) return result("ours")
    const current = meta[PaymentNoticeMeta.HOLD_RELEASED] as { payment_intent?: unknown } | undefined
    if (current?.payment_intent === input.payment_intent) return result("known")
    return result("due", {
      [PaymentNoticeMeta.HOLD_RELEASED]: {
        payment_intent: input.payment_intent,
        reason: input.reason,
        amount_pence: input.amount_pence,
        at: new Date().toISOString(),
      },
    })
  }
)
