import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { collectLockKey } from "../lib/click-collect"
import { updateOrderMetadataStep } from "./steps/click-collect/update-order-metadata"
import { lockOwnerStep } from "./steps/lock-owner"
import { prepareHoldReleasedStep, type PrepareHoldReleasedInput } from "./steps/payment/prepare-hold-released"

/**
 * payment_intent.canceled on a live order: under the order's lock, decides
 * whether the hold was released at Stripe (not by us) and, the first time,
 * writes `payment_hold_released` to the order (docs/contracts/payments.md
 * section 3). Returns the decision; the caller alerts and emails.
 */
export const recordHoldReleasedWorkflow = createWorkflow(
  "record-hold-released",
  function (input: PrepareHoldReleasedInput) {
    const owner = lockOwnerStep({ workflow: "record-hold-released" })
    // Waits for a cancel of ours that holds the lock (the expiry's takes well under a minute).
    const lock = transform({ input, owner }, ({ input, owner }) => ({
      ownerId: owner,
      key: collectLockKey(input.order_id),
      timeout: 60,
      ttl: 30,
    }))
    acquireLockStep(lock)

    const prepared = prepareHoldReleasedStep(input)
    when("record-if-due", { prepared }, ({ prepared }) => prepared.state === "due").then(() => {
      const update = transform({ input, prepared }, ({ input, prepared }) => ({
        order_id: input.order_id,
        patch: prepared.patch,
      }))
      updateOrderMetadataStep(update)
    })

    const unlock = transform({ input, owner }, ({ input, owner }) => ({
      key: collectLockKey(input.order_id),
      ownerId: owner,
    }))
    releaseLockStep(unlock)

    const result = transform({ prepared }, ({ prepared }) => ({ state: prepared.state }))
    return new WorkflowResponse(result)
  }
)
