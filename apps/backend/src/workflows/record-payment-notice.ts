import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { collectLockKey } from "../lib/click-collect"
import { updateOrderMetadataStep } from "./steps/click-collect/update-order-metadata"
import { lockOwnerStep } from "./steps/lock-owner"

export type RecordPaymentNoticeInput = {
  order_id: string
  /** Metadata keys to set (docs/contracts/payments.md section 3). Other keys are kept. */
  patch: Record<string, unknown>
}

/**
 * Writes what Stripe told us about an order's payment (a dispute, a refund
 * made outside the admin, a hold released at Stripe) into the order's
 * metadata, under the order's lock so it can't interleave with a capture or
 * a collection in flight.
 */
export const recordPaymentNoticeWorkflow = createWorkflow(
  "record-payment-notice",
  function (input: RecordPaymentNoticeInput) {
    const owner = lockOwnerStep({ workflow: "record-payment-notice" })
    const lock = transform({ input, owner }, ({ input, owner }) => ({
      ownerId: owner,
      key: collectLockKey(input.order_id),
      timeout: 10,
      ttl: 30,
    }))
    acquireLockStep(lock)

    const update = transform({ input }, ({ input }) => ({ order_id: input.order_id, patch: input.patch }))
    const metadata = updateOrderMetadataStep(update)

    const unlock = transform({ input, owner }, ({ input, owner }) => ({
      key: collectLockKey(input.order_id),
      ownerId: owner,
    }))
    releaseLockStep(unlock)

    return new WorkflowResponse(metadata)
  }
)
