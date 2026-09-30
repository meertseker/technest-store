import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"

export type CaptureOrderPaymentsInput = {
  order_id: string
  payment_ids: string[]
  captured_by?: string
}

/**
 * Captures each payment that isn't captured yet (a retry never captures
 * twice) with Medusa's capturePaymentWorkflow, which calls the provider and
 * records the order transaction.
 *
 * A capture can't be undone safely. If a later step fails, compensation does
 * NOT refund: it logs the order id so staff can retry, and the API route tells
 * staff the payment was captured.
 */
export const captureOrderPaymentsStep = createStep(
  "capture-order-payments",
  async (input: CaptureOrderPaymentsInput, { container }) => {
    const payments = container.resolve(Modules.PAYMENT)
    const captured: string[] = []
    for (const id of input.payment_ids) {
      const payment = await payments.retrievePayment(id, { select: ["id", "captured_at"] })
      if (payment.captured_at) continue
      await capturePaymentWorkflow(container).run({
        input: { payment_id: id, captured_by: input.captured_by },
      })
      captured.push(id)
    }
    return new StepResponse(captured, { order_id: input.order_id, captured })
  },
  async (comp, { container }) => {
    if (!comp?.captured.length) return
    // IDs only: never card data or customer details.
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `Payment captured for order ${comp.order_id} ` +
          `(payments ${comp.captured.join(", ")}) but a later step failed. ` +
          `Not refunded automatically: retry the action or refund from the order page.`
      )
  }
)
