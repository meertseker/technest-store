import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { ClickCollectEvents } from "../../../lib/click-collect"

export type CaptureOrderPaymentsInput = {
  order_id: string
  payment_ids: string[]
  captured_by?: string
}

/**
 * Captures each payment that isn't captured yet (a retry never captures
 * twice) with Medusa's capturePaymentWorkflow, which calls the provider,
 * records the order transaction and emits `payment.captured`.
 *
 * When the provider refuses a capture, emits
 * `technest.payment.capture_failed` `{ order_id }` straight away (not grouped
 * with the workflow's events, which are dropped on failure) and fails with a
 * PAYMENT_AUTHORIZATION_ERROR (HTTP 422).
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
      try {
        await capturePaymentWorkflow(container).run({
          input: { payment_id: id, captured_by: input.captured_by },
        })
      } catch (e) {
        // IDs and the provider's message only: never card data or customer details.
        container
          .resolve(ContainerRegistrationKeys.LOGGER)
          .error(`Capture failed for order ${input.order_id} (payment ${id}): ${(e as Error).message}`)
        await container.resolve(Modules.EVENT_BUS).emit({
          name: ClickCollectEvents.CAPTURE_FAILED,
          data: { order_id: input.order_id },
        })
        throw new MedusaError(
          MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
          `Payment could not be captured (${(e as Error).message}).` +
            (captured.length ? "" : " No money was taken.")
        )
      }
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
