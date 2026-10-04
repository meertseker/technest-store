import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { CaptureRetryMeta } from "../lib/capture-retry/constants"
import { updateOrderMetadataStep } from "./steps/click-collect/update-order-metadata"

export type RecordCaptureRetryInput = {
  order_id: string
  /** Failed attempts so far, this one included. */
  attempts: number
  /** ISO time of this attempt. */
  at: string
  gave_up: boolean
}

/** Notes a failed capture retry on the order, so the job can back off and give up. */
export const recordCaptureRetryWorkflow = createWorkflow(
  "record-capture-retry",
  function (input: RecordCaptureRetryInput) {
    const update = transform({ input }, ({ input }) => ({
      order_id: input.order_id,
      patch: {
        [CaptureRetryMeta.ATTEMPTS]: input.attempts,
        [CaptureRetryMeta.LAST_AT]: input.at,
        ...(input.gave_up ? { [CaptureRetryMeta.GAVE_UP_AT]: input.at } : {}),
      },
    }))
    const metadata = updateOrderMetadataStep(update)
    return new WorkflowResponse(metadata)
  }
)
