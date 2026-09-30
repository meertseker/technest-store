import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createPaymentSessionsWorkflow } from "@medusajs/medusa/core-flows"
import { KLARNA_MIN_CONTEXT_KEY } from "../modules/stripe/service"
import { getKlarnaMinBasketStep } from "./steps/get-klarna-min-basket"

export type CreateTechnestPaymentSessionsInput = {
  payment_collection_id: string
  provider_id: string
  customer_id?: string
}

/**
 * Medusa's createPaymentSessionsWorkflow plus the Klarna minimum from the
 * settings module, passed in the payment session `context` (server-side
 * only). The Stripe provider reads it to include or exclude Klarna and to set
 * `klarna_available` on the session data (docs/contracts/payments.md).
 * Client `data` is never forwarded (ADR 0002). Compensation is the core
 * workflow's: the session is deleted if a later step fails.
 */
export const createTechnestPaymentSessionsWorkflow = createWorkflow(
  "create-technest-payment-sessions",
  function (input: CreateTechnestPaymentSessionsInput) {
    const klarnaMin = getKlarnaMinBasketStep()

    const coreInput = transform({ input, klarnaMin }, ({ input, klarnaMin }) => ({
      payment_collection_id: input.payment_collection_id,
      provider_id: input.provider_id,
      customer_id: input.customer_id,
      context: { [KLARNA_MIN_CONTEXT_KEY]: klarnaMin },
    }))

    const session = createPaymentSessionsWorkflow.runAsStep({ input: coreInput })

    return new WorkflowResponse(session)
  }
)
