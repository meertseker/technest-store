import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { setFreeDeliveryThresholdStep } from "./steps/set-free-delivery-threshold"

/**
 * Applies a free-delivery threshold to Standard delivery without saving the
 * setting. The seed and the backfill migration script use it with the current
 * value from `getTechnestSettings`.
 */
export const applyFreeDeliveryThresholdWorkflow = createWorkflow(
  "apply-free-delivery-threshold",
  function (input: { threshold_pence: number }) {
    const result = setFreeDeliveryThresholdStep(input)
    return new WorkflowResponse(result)
  }
)
