import { MathBN, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

/**
 * Recomputes a payment collection's `refunded_amount` from its payments'
 * refunds, the way the payment module does after its own refunds. The order's
 * payment status (partially refunded / refunded) is derived from it.
 */
export const refreshPaymentCollectionRefundsStep = createStep(
  "refresh-payment-collection-refunds",
  async ({ payment_collection_id }: { payment_collection_id: string }, { container }) => {
    const payments = container.resolve(Modules.PAYMENT)
    const before = await payments.retrievePaymentCollection(payment_collection_id, {
      select: ["id", "refunded_amount"],
      relations: ["payments", "payments.refunds"],
    })
    let refunded = MathBN.convert(0)
    for (const payment of before.payments ?? []) {
      for (const refund of payment.refunds ?? []) {
        refunded = MathBN.add(refunded, refund.amount)
      }
    }
    // Not in the public update type, but the field the module itself maintains.
    await payments.updatePaymentCollections(payment_collection_id, { refunded_amount: refunded } as never)
    return new StepResponse(void 0, { payment_collection_id, refunded_amount: before.refunded_amount ?? 0 })
  },
  async (previous, { container }) => {
    if (!previous) return
    await container
      .resolve(Modules.PAYMENT)
      .updatePaymentCollections(previous.payment_collection_id, { refunded_amount: previous.refunded_amount } as never)
  }
)
