import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { purgeExpiredRecordsStep, type PurgeExpiredRecordsInput } from "./steps/purge-expired-records"

/** Daily personal-data retention run (job data-retention). */
export const purgeExpiredRecordsWorkflow = createWorkflow(
  "purge-expired-records",
  function (input: PurgeExpiredRecordsInput) {
    const result = purgeExpiredRecordsStep(input)
    return new WorkflowResponse(result)
  }
)
