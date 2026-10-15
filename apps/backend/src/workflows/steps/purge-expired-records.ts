import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { purgeExpiredRecords, type RetentionEnv } from "../../lib/data-retention"

export type PurgeExpiredRecordsInput = {
  /** ISO date the retention is measured from (default: now). */
  now?: string
  /** Retention settings (default: process.env). */
  env?: RetentionEnv
}

/**
 * Hard-deletes the repair bookings and trade applications whose retention
 * has run out (see lib/data-retention.ts). No compensation: the point of the
 * step is that the data is gone, and nothing runs after it in the workflow
 * that could fail and ask for it back.
 */
export const purgeExpiredRecordsStep = createStep(
  "purge-expired-records",
  async (input: PurgeExpiredRecordsInput, { container }) => {
    const result = await purgeExpiredRecords(container, {
      now: input.now ? new Date(input.now) : new Date(),
      env: input.env ?? (process.env as RetentionEnv),
    })
    return new StepResponse(result)
  }
)
