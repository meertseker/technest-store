import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, emitEventStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ClickCollectEvents, collectLockKey } from "../lib/click-collect"
import { prepareReadyResendStep } from "./steps/click-collect/prepare-ready-resend"
import { updateOrderMetadataStep } from "./steps/click-collect/update-order-metadata"
import { lockOwnerStep } from "./steps/lock-owner"

export type ResendReadyForCollectionInput = { order_id: string }

/**
 * Click & Collect: staff resend the "ready for collection" email (the first
 * one bounced, went to spam, or the customer lost it). Emits
 * `technest.order.ready_for_collection` `{ order_id, resend: true, send_key }`;
 * the send key makes each press its own email, while a redelivery of the same
 * event still sends nothing more. Records `ready_email_resent_at`.
 */
export const resendReadyForCollectionWorkflow = createWorkflow(
  "resend-ready-for-collection",
  function (input: ResendReadyForCollectionInput) {
    const owner = lockOwnerStep({ workflow: "resend-ready-for-collection" })
    const lock = transform({ input, owner }, ({ input, owner }) => ({
      ownerId: owner,
      key: collectLockKey(input.order_id),
      timeout: 10,
      ttl: 30,
    }))
    acquireLockStep(lock)

    const prepared = prepareReadyResendStep({ order_id: input.order_id })
    const update = transform({ input, prepared }, ({ input, prepared }) => ({
      order_id: input.order_id,
      patch: prepared.patch,
    }))
    updateOrderMetadataStep(update)
    const event = transform({ input, prepared }, ({ input, prepared }) => ({
      eventName: ClickCollectEvents.READY_FOR_COLLECTION,
      data: { order_id: input.order_id, resend: true, send_key: prepared.send_key },
    }))
    emitEventStep(event)

    const unlock = transform({ input, owner }, ({ input, owner }) => ({
      key: collectLockKey(input.order_id),
      ownerId: owner,
    }))
    releaseLockStep(unlock)

    return new WorkflowResponse(transform({ prepared }, ({ prepared }) => ({ send_key: prepared.send_key })))
  }
)
