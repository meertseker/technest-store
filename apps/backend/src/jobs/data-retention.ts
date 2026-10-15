import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { reportError, reportingJob } from "../lib/alerting"
import { isLockBusyError } from "../lib/lock-busy"
import { purgeExpiredRecordsWorkflow } from "../workflows/purge-expired-records"

/**
 * Daily, 03:20: removes repair bookings not updated for a while and closed trade
 * applications once they are older than REPAIR_RETENTION_DAYS /
 * TRADE_RETENTION_DAYS (default 365), see lib/data-retention.ts.
 */
async function dataRetentionJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    // One run at a time (server and worker both load jobs; only the worker runs them, but a slow run must not overlap).
    const { result } = await container
      .resolve(Modules.LOCKING)
      .execute(
        "technest-data-retention",
        () => purgeExpiredRecordsWorkflow(container).run({ input: {} }),
        { timeout: 1 }
      )
    if (result.repair_bookings || result.trade_applications) {
      logger.info(
        `data-retention: removed ${result.repair_bookings} repair bookings and ${result.trade_applications} trade applications`
      )
    }
  } catch (e) {
    if (isLockBusyError(e)) return
    // Don't throw from a scheduled job: log, report and try again tomorrow.
    logger.error(`data-retention: run failed: ${(e as Error).message}`)
    reportError(e, { source: "job:data-retention" })
  }
}

export default reportingJob("data-retention", dataRetentionJob)

export const config = {
  name: "data-retention",
  schedule: "20 3 * * *",
}
