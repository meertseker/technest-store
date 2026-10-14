import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, emitEventStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ClickCollectEvents, collectLockKey } from "../lib/click-collect"
import { captureOrderPaymentsStep } from "./steps/click-collect/capture-order-payments"
import { prepareOutsideBoardStep } from "./steps/click-collect/prepare-outside-board"
import { updateOrderMetadataStep } from "./steps/click-collect/update-order-metadata"
import { lockOwnerStep } from "./steps/lock-owner"

export type CollectOutsideBoardInput = { order_id: string }

/**
 * A Click & Collect order whose goods were handed over with Medusa's own
 * order-page buttons (fulfilment marked delivered or shipped) instead of the
 * board's "Collected": captures the authorised payment (never twice), records
 * `collected_at` and `collected_outside_board`, and emits
 * `technest.order.collected`, as "Collected" would. Under the order's lock,
 * so it can't interleave with a press on the board.
 *
 * A failed capture is not announced to the customer here (the caller retries
 * next hour and alerts staff); the order stays uncollected until it works.
 */
export const collectOutsideBoardWorkflow = createWorkflow(
  "collect-outside-board",
  function (input: CollectOutsideBoardInput) {
    const owner = lockOwnerStep({ workflow: "collect-outside-board" })
    const lock = transform({ input, owner }, ({ input, owner }) => ({
      ownerId: owner,
      key: collectLockKey(input.order_id),
      timeout: 10,
      ttl: 120,
    }))
    acquireLockStep(lock)

    const prepared = prepareOutsideBoardStep({ order_id: input.order_id })

    when("collect-if-handed-over", { prepared }, ({ prepared }) => prepared.due).then(() => {
      const capture = transform({ input, prepared }, ({ input, prepared }) => ({
        order_id: input.order_id,
        payment_ids: prepared.payment_ids,
        notify_on_failure: false,
      }))
      captureOrderPaymentsStep(capture)
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

    const unlock = transform({ input, owner }, ({ input, owner }) => ({
      key: collectLockKey(input.order_id),
      ownerId: owner,
    }))
    releaseLockStep(unlock)

    const result = transform({ prepared }, ({ prepared }) => ({
      collected: prepared.due,
      fulfillment_id: prepared.fulfillment_id,
    }))
    return new WorkflowResponse(result)
  }
)
