import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type CreateRefundRecordInput = {
  payment_id: string
  /** Major units, as Medusa stores payment amounts. */
  amount: number
  note: string
  metadata: Record<string, unknown>
}

/**
 * The payment module's generated CRUD for its Refund model. Its public
 * interface only declares refundPayment, which would call the provider: for a
 * refund that already happened at Stripe only the record may be written.
 */
type RefundRecords = {
  createRefunds(data: CreateRefundRecordInput[]): Promise<{ id: string }[]>
  deleteRefunds(ids: string[]): Promise<void>
}

/** Writes a refund row for money the provider already returned. Compensation deletes it. */
export const createRefundRecordStep = createStep(
  "create-refund-record",
  async (input: CreateRefundRecordInput, { container }) => {
    const payments = container.resolve(Modules.PAYMENT) as unknown as RefundRecords
    const [refund] = await payments.createRefunds([input])
    return new StepResponse(refund, refund.id)
  },
  async (id, { container }) => {
    if (!id) return
    await (container.resolve(Modules.PAYMENT) as unknown as RefundRecords).deleteRefunds([id])
  }
)
