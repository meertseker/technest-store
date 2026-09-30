import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  cancelOrderWorkflow,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { ClickCollectEvents, collectLockKey } from "../lib/click-collect"
import {
  prepareCollectionExpiryStep,
  prepareCollectionReminderStep,
} from "./steps/click-collect/prepare-uncollected"
import { ensureAuthorisationReleasedStep } from "./steps/click-collect/ensure-authorisation-released"
import { updateOrderMetadataStep } from "./steps/click-collect/update-order-metadata"

export type UncollectedOrderInput = { order_id: string }

/**
 * Emits `technest.order.collection_reminder` `{ order_id }` once, 3 days
 * after the order was marked ready (tracked in metadata).
 */
export const remindUncollectedOrderWorkflow = createWorkflow(
  "remind-uncollected-order",
  function (input: UncollectedOrderInput) {
    const lock = transform({ input }, ({ input }) => ({
      key: collectLockKey(input.order_id),
      timeout: 5,
      ttl: 30,
    }))
    acquireLockStep(lock)

    const prepared = prepareCollectionReminderStep({ order_id: input.order_id })

    when("remind-if-due", { prepared }, ({ prepared }) => prepared.due).then(() => {
      const update = transform({ input, prepared }, ({ input, prepared }) => ({
        order_id: input.order_id,
        patch: prepared.patch,
      }))
      updateOrderMetadataStep(update)
      const event = transform({ input }, ({ input }) => ({
        eventName: ClickCollectEvents.COLLECTION_REMINDER,
        data: { order_id: input.order_id },
      }))
      emitEventStep(event)
    })

    const unlock = transform({ input }, ({ input }) => ({ key: collectLockKey(input.order_id) }))
    releaseLockStep(unlock)

    const result = transform({ prepared }, ({ prepared }) => ({ reminded: prepared.due }))
    return new WorkflowResponse(result)
  }
)

/**
 * 7 days after "ready" and still uncollected: cancels the order with
 * Medusa's cancelOrderWorkflow, which cancels the uncaptured payment (the
 * card authorisation is released), releases stock reservations and emits
 * `order.canceled`. Records `collection_expired_at` first, so a failed cancel
 * rolls the metadata back too. Core only logs a failed payment cancel, so
 * the last step retries releasing any authorisation still held.
 */
export const expireUncollectedOrderWorkflow = createWorkflow(
  "expire-uncollected-order",
  function (input: UncollectedOrderInput) {
    const lock = transform({ input }, ({ input }) => ({
      key: collectLockKey(input.order_id),
      timeout: 5,
      ttl: 60,
    }))
    acquireLockStep(lock)

    const prepared = prepareCollectionExpiryStep({ order_id: input.order_id })

    const release = when("expire-if-due", { prepared }, ({ prepared }) => prepared.due).then(
      () => {
        const update = transform({ input, prepared }, ({ input, prepared }) => ({
          order_id: input.order_id,
          patch: prepared.patch,
        }))
        updateOrderMetadataStep(update)
        const cancel = transform({ input }, ({ input }) => ({ order_id: input.order_id }))
        cancelOrderWorkflow.runAsStep({ input: cancel })
        return ensureAuthorisationReleasedStep(cancel)
      }
    )

    const unlock = transform({ input }, ({ input }) => ({ key: collectLockKey(input.order_id) }))
    releaseLockStep(unlock)

    const result = transform({ prepared, release }, ({ prepared, release }) => ({
      expired: prepared.due,
      // Null when nothing was due.
      authorisation_released: prepared.due ? (release?.released ?? false) : null,
    }))
    return new WorkflowResponse(result)
  }
)
