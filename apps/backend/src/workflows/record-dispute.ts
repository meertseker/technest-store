import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { collectLockKey } from "../lib/click-collect"
import { updateOrderMetadataStep } from "./steps/click-collect/update-order-metadata"
import { lockOwnerStep } from "./steps/lock-owner"
import { applyDisputeEventStep, type ApplyDisputeEventInput } from "./steps/payment/apply-dispute-event"

/**
 * charge.dispute.*: writes the dispute to the order's `disputes` under the
 * order's lock (docs/contracts/payments.md section 3). Returns what the event
 * did; the caller alerts and emails on an opening.
 */
export const recordDisputeWorkflow = createWorkflow("record-dispute", function (input: ApplyDisputeEventInput) {
  const owner = lockOwnerStep({ workflow: "record-dispute" })
  const lock = transform({ input, owner }, ({ input, owner }) => ({
    ownerId: owner,
    key: collectLockKey(input.order_id),
    timeout: 10,
    ttl: 30,
  }))
  acquireLockStep(lock)

  const applied = applyDisputeEventStep(input)
  when("write-if-changed", { applied }, ({ applied }) => applied.state === "opened" || applied.state === "updated").then(
    () => {
      const update = transform({ input, applied }, ({ input, applied }) => ({
        order_id: input.order_id,
        patch: applied.patch,
      }))
      updateOrderMetadataStep(update)
    }
  )

  const unlock = transform({ input, owner }, ({ input, owner }) => ({
    key: collectLockKey(input.order_id),
    ownerId: owner,
  }))
  releaseLockStep(unlock)

  const result = transform({ applied }, ({ applied }) => ({ state: applied.state }))
  return new WorkflowResponse(result)
})
