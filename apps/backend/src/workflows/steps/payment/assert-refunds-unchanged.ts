import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { toPence } from "../../../lib/email/order-email-data"

export type AssertRefundsUnchangedInput = {
  payment_id: string
  /** The payment's refund total, in pence, that the caller based its decision on. */
  known_pence: number
  /** Stripe's refund id (or the fallback key) about to be written. */
  stripe_refund_id: string
}

/** Thrown when the payment's refunds changed between the caller's read and the lock. */
export const REFUNDS_CHANGED = "The payment's refunds changed while this refund was being recorded"

/**
 * Runs under the order's lock, before a refund made at Stripe is written to
 * Medusa: re-reads the payment's refunds and refuses when they are no longer
 * what the caller saw (another delivery of the same event, or an admin
 * refund, got there first). The caller reads again and decides afresh, so a
 * refund is never written twice.
 */
export const assertRefundsUnchangedStep = createStep(
  "assert-refunds-unchanged",
  async (input: AssertRefundsUnchangedInput, { container }) => {
    const payment = await container.resolve(Modules.PAYMENT).retrievePayment(input.payment_id, {
      select: ["id"],
      relations: ["refunds"],
    })
    const refunds = payment.refunds ?? []
    const totalPence = refunds.reduce((sum, r) => sum + toPence(r?.amount), 0)
    const already = refunds.some(
      // The Refund model has metadata; the generated DTO type doesn't declare it.
      (r) => (r as { metadata?: Record<string, unknown> | null } | null)?.metadata?.stripe_refund_id === input.stripe_refund_id
    )
    if (already || totalPence !== input.known_pence) {
      throw new MedusaError(MedusaError.Types.CONFLICT, REFUNDS_CHANGED)
    }
    return new StepResponse(true)
  }
)
