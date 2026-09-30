import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createOrderFulfillmentWorkflow,
  emitEventStep,
  markOrderFulfillmentAsDeliveredWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { ClickCollectEvents, collectLockKey } from "../lib/click-collect"
import { captureOrderPaymentsStep } from "./steps/click-collect/capture-order-payments"
import { prepareCollectionStep } from "./steps/click-collect/prepare-collection"
import { updateOrderMetadataStep } from "./steps/click-collect/update-order-metadata"

export type MarkCollectedInput = {
  order_id: string
  /** Admin user id, recorded on the capture and the fulfilment. */
  actor_id?: string
}

/**
 * Click & Collect: the customer has the goods. Captures the authorised
 * payment, fulfils the remaining items from the pickup location and marks
 * that fulfilment delivered, records `collected_at` and emits
 * `technest.order.collected` `{ order_id }`.
 *
 * If fulfilment or delivery fails after the capture, those steps roll back
 * but the capture stays (it is never refunded automatically). A retry skips
 * the capture because the payment is already captured.
 * Collecting a collected order again is a no-op.
 */
export const markCollectedWorkflow = createWorkflow(
  "mark-collected",
  function (input: MarkCollectedInput) {
    const lock = transform({ input }, ({ input }) => ({
      key: collectLockKey(input.order_id),
      timeout: 5,
      ttl: 120,
    }))
    acquireLockStep(lock)

    const prepared = prepareCollectionStep({ order_id: input.order_id })

    when("capture-if-not-collected", { prepared }, ({ prepared }) => !prepared.already_collected)
      .then(() => {
        const capture = transform({ input, prepared }, ({ input, prepared }) => ({
          order_id: input.order_id,
          payment_ids: prepared.payment_ids,
          captured_by: input.actor_id,
        }))
        captureOrderPaymentsStep(capture)
      })

    when(
      "fulfil-if-not-collected",
      { prepared },
      ({ prepared }) => !prepared.already_collected && prepared.items.length > 0
    ).then(() => {
      const fulfilmentInput = transform({ input, prepared }, ({ input, prepared }) => ({
        order_id: input.order_id,
        items: prepared.items,
        created_by: input.actor_id,
        // The customer is at the counter: no "shipped" style notification.
        no_notification: true,
      }))
      const fulfillment = createOrderFulfillmentWorkflow.runAsStep({ input: fulfilmentInput })
      const deliveredInput = transform({ input, fulfillment }, ({ input, fulfillment }) => ({
        orderId: input.order_id,
        fulfillmentId: fulfillment.id,
        no_notification: true,
      }))
      markOrderFulfillmentAsDeliveredWorkflow.runAsStep({ input: deliveredInput })
    })

    when("finish-if-not-collected", { prepared }, ({ prepared }) => !prepared.already_collected)
      .then(() => {
        const update = transform({ input, prepared }, ({ input, prepared }) => ({
          order_id: input.order_id,
          patch: prepared.patch,
        }))
        updateOrderMetadataStep(update)
        const event = transform({ input }, ({ input }) => ({
          eventName: ClickCollectEvents.COLLECTED,
          data: { order_id: input.order_id },
        }))
        emitEventStep(event)
      })

    const unlock = transform({ input }, ({ input }) => ({ key: collectLockKey(input.order_id) }))
    releaseLockStep(unlock)

    const result = transform({ input, prepared }, ({ input, prepared }) => ({
      order_id: input.order_id,
      already_collected: prepared.already_collected,
    }))
    return new WorkflowResponse(result)
  }
)
