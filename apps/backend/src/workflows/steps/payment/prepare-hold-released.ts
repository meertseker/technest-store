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

/** The decision, from the payment and order as read under the lock. */
export function decideHoldReleased(
  input: PrepareHoldReleasedInput,
  payment: { canceled_at?: unknown },
  order: { status?: unknown; metadata?: Record<string, unknown> | null },
  now = Date.now()
): PrepareHoldReleasedOutput {
  if (payment.canceled_at) return { state: "ours", patch: {} }
  if (order.status === "canceled") return { state: "order_cancelled", patch: {} }
  const meta = order.metadata ?? {}
  const started = Date.parse(String(meta[CollectMeta.CANCEL_STARTED] ?? ""))
  if (Number.isFinite(started) && now - started < CANCEL_IN_FLIGHT_MS) return { state: "ours", patch: {} }
  const current = meta[PaymentNoticeMeta.HOLD_RELEASED] as { payment_intent?: unknown } | undefined
  if (current?.payment_intent === input.payment_intent) return { state: "known", patch: {} }
  return {
    state: "due",
    patch: {
      [PaymentNoticeMeta.HOLD_RELEASED]: {
        payment_intent: input.payment_intent,
        reason: input.reason,
        amount_pence: input.amount_pence,
        at: new Date(now).toISOString(),
      },
    },
  }
}

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
    const order = await container
      .resolve(Modules.ORDER)
      .retrieveOrder(input.order_id, { select: ["id", "status", "metadata"] })
    return new StepResponse<PrepareHoldReleasedOutput>(decideHoldReleased(input, payment, order))
  }
)
