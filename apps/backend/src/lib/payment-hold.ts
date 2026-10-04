import { MedusaError } from "@medusajs/framework/utils"

/**
 * Steps of Medusa's completeCartWorkflow that run before its own authorise
 * step and refuse a basket for good: the `validate` hook (our basket rules),
 * the shipping check and the stock reservation.
 */
const PRE_PAYMENT_STEPS = ["validate", "validate-shipping", "reserve-inventory-step"]

/** Refusals no retry of the same basket will pass. */
const REFUSAL_TYPES: string[] = [MedusaError.Types.NOT_ALLOWED, MedusaError.Types.INVALID_DATA]

export type CompletionFailure = { action?: string; error?: { type?: string } | null }

/**
 * True when cart completion was refused by a step before the payment was
 * authorised in Medusa. Only then is a card hold left behind that nothing
 * else releases. A refusal by the authorise step itself (the session isn't
 * authorised yet, e.g. 3-D Secure still open) must never release anything.
 */
export function completionRefusedBeforePayment(failure: CompletionFailure | undefined): boolean {
  if (!failure?.action || !PRE_PAYMENT_STEPS.includes(failure.action)) return false
  return REFUSAL_TYPES.includes(failure.error?.type ?? "")
}
