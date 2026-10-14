import { MathBN, PaymentEvents } from "@medusajs/framework/utils"
import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  addOrderTransactionStep,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { collectLockKey } from "../lib/click-collect"
import { updateOrderMetadataStep } from "./steps/click-collect/update-order-metadata"
import { assertRefundsUnchangedStep } from "./steps/payment/assert-refunds-unchanged"
import { createRefundRecordStep } from "./steps/payment/create-refund-record"
import { refreshPaymentCollectionRefundsStep } from "./steps/payment/refresh-payment-collection-refunds"
import { lockOwnerStep } from "./steps/lock-owner"

export type RecordExternalRefundInput = {
  order_id: string
  payment_id: string
  payment_collection_id: string
  /** Major units (4.99), as Medusa stores payment amounts. */
  amount: number
  currency_code: string
  /** The payment's refund total in pence that this decision was based on; checked again under the lock. */
  known_pence: number
  /** Stripe's refund id, or `<charge id>:<amount refunded>` when the event did not list it. */
  stripe_refund_id: string
  /** Order metadata to set alongside (the `external_refunds` note). */
  metadata_patch: Record<string, unknown>
}

/**
 * Records a refund that was made at Stripe (dashboard), not through Medusa.
 * The money has already moved, so Medusa's refundPaymentWorkflow (which asks
 * the provider to refund) can't be used; this writes what it would have
 * written: the refund on the payment, the order transaction, the collection's
 * refunded amount, and `payment.refunded` so the customer gets the usual
 * refund email. Every step compensates; the order's lock is held throughout.
 */
export const recordExternalRefundWorkflow = createWorkflow(
  "record-external-refund",
  function (input: RecordExternalRefundInput) {
    const owner = lockOwnerStep({ workflow: "record-external-refund" })
    const lock = transform({ input, owner }, ({ input, owner }) => ({
      ownerId: owner,
      key: collectLockKey(input.order_id),
      timeout: 10,
      ttl: 30,
    }))
    acquireLockStep(lock)

    const guard = transform({ input }, ({ input }) => ({
      payment_id: input.payment_id,
      known_pence: input.known_pence,
      stripe_refund_id: input.stripe_refund_id,
    }))
    assertRefundsUnchangedStep(guard)

    const refundInput = transform({ input }, ({ input }) => ({
      payment_id: input.payment_id,
      amount: input.amount,
      note: `Refunded in the Stripe dashboard (${input.stripe_refund_id}), not through the admin`,
      metadata: { stripe_refund_id: input.stripe_refund_id, source: "stripe_dashboard" },
    }))
    const refund = createRefundRecordStep(refundInput)

    const transaction = transform({ input, refund }, ({ input, refund }) => ({
      order_id: input.order_id,
      amount: MathBN.mult(input.amount, -1),
      currency_code: input.currency_code,
      reference: "refund",
      reference_id: refund.id,
    }))
    addOrderTransactionStep(transaction)

    const collection = transform({ input }, ({ input }) => ({ payment_collection_id: input.payment_collection_id }))
    refreshPaymentCollectionRefundsStep(collection)

    const metadata = transform({ input }, ({ input }) => ({ order_id: input.order_id, patch: input.metadata_patch }))
    updateOrderMetadataStep(metadata)

    const event = transform({ input }, ({ input }) => ({
      eventName: PaymentEvents.REFUNDED,
      data: { id: input.payment_id },
    }))
    emitEventStep(event)

    const unlock = transform({ input, owner }, ({ input, owner }) => ({
      key: collectLockKey(input.order_id),
      ownerId: owner,
    }))
    releaseLockStep(unlock)

    return new WorkflowResponse(refund)
  }
)
