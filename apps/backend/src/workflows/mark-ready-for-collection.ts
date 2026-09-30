import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, emitEventStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ClickCollectEvents, collectLockKey } from "../lib/click-collect"
import { prepareReadyForCollectionStep } from "./steps/click-collect/prepare-ready-for-collection"
import { updateOrderMetadataStep } from "./steps/click-collect/update-order-metadata"

export type MarkReadyForCollectionInput = { order_id: string }

/**
 * Click & Collect: staff have picked the order. Stores a collection code and
 * the ready time in the order metadata and emits
 * `technest.order.ready_for_collection` `{ order_id }`. Marking a ready order
 * ready again is a no-op (no second event).
 */
export const markReadyForCollectionWorkflow = createWorkflow(
  "mark-ready-for-collection",
  function (input: MarkReadyForCollectionInput) {
    const lock = transform({ input }, ({ input }) => ({
      key: collectLockKey(input.order_id),
      timeout: 5,
      ttl: 30,
    }))
    acquireLockStep(lock)

    const prepared = prepareReadyForCollectionStep({ order_id: input.order_id })

    when("mark-ready-if-needed", { prepared }, ({ prepared }) => !prepared.already_ready).then(
      () => {
        const update = transform({ input, prepared }, ({ input, prepared }) => ({
          order_id: input.order_id,
          patch: prepared.patch,
        }))
        updateOrderMetadataStep(update)
        const event = transform({ input }, ({ input }) => ({
          eventName: ClickCollectEvents.READY_FOR_COLLECTION,
          data: { order_id: input.order_id },
        }))
        emitEventStep(event)
      }
    )

    const unlock = transform({ input }, ({ input }) => ({ key: collectLockKey(input.order_id) }))
    releaseLockStep(unlock)

    const result = transform({ input, prepared }, ({ input, prepared }) => ({
      order_id: input.order_id,
      already_ready: prepared.already_ready,
    }))
    return new WorkflowResponse(result)
  }
)
