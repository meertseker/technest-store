import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type EnsureAuthorisationReleasedOutput = {
  /** False when a payment is still authorised after the retry (logged). */
  released: boolean
}

/**
 * Runs after Medusa's cancelOrderWorkflow, whose cancelPaymentStep only logs
 * a provider error, so the order can end up cancelled while the card is still
 * on hold. Retries the cancel once for any payment that is neither captured
 * nor cancelled. A failure here is logged (ids only) instead of thrown: the
 * order is already cancelled and the hold lapses on its own at the bank.
 *
 * No compensation: releasing an authorisation can't be undone, and this is
 * the last step of the workflow.
 */
export const ensureAuthorisationReleasedStep = createStep(
  "ensure-authorisation-released",
  async ({ order_id }: { order_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "payment_collections.payments.id",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
      ],
      filters: { id: order_id },
    })
    const pending = (data[0]?.payment_collections ?? [])
      .flatMap((pc) => pc?.payments ?? [])
      .filter((p) => p && !p.captured_at && !p.canceled_at)
      .map((p) => p!.id)

    const payments = container.resolve(Modules.PAYMENT)
    let released = true
    for (const id of pending) {
      try {
        await payments.cancelPayment(id)
      } catch (e) {
        released = false
        logger.error(
          `Click & Collect: order ${order_id} was cancelled but payment ${id} is still ` +
            `authorised (${(e as Error).message}). Release it in the Stripe dashboard.`
        )
      }
    }
    return new StepResponse<EnsureAuthorisationReleasedOutput>({ released })
  }
)
