import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { reportError, reportingJob } from "../lib/alerting"
import { isLockBusyError } from "../lib/click-collect"
import { notificationRetentionDays, purgeOldNotifications, type RetentionDeps } from "../lib/email/retention"
import { safeErrorMessage } from "../lib/email/safe-error"

/**
 * Once a day: delete stored email attempts (and with them the recipient
 * addresses) older than NOTIFICATION_RETENTION_DAYS. See lib/email/retention.
 */
async function notificationRetentionJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await container.resolve(Modules.LOCKING).execute(
      "technest-notification-retention",
      () =>
        purgeOldNotifications(
          {
            notifications: container.resolve(Modules.NOTIFICATION) as unknown as RetentionDeps["notifications"],
            logger,
          },
          new Date(),
          notificationRetentionDays()
        ),
      { timeout: 1 }
    )
  } catch (e) {
    if (isLockBusyError(e)) return
    // Don't throw from a scheduled job: log, report and try again tomorrow.
    logger.error(`notification-retention: run failed: ${safeErrorMessage(e)}`)
    reportError(e, { source: "job:notification-retention" })
  }
}

export default reportingJob("notification-retention", notificationRetentionJob)

export const config = {
  name: "notification-retention",
  // 03:40 UTC, a quiet hour; the backup runs on its own schedule.
  schedule: "40 3 * * *",
}
