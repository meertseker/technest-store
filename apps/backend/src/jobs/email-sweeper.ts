import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { reportError, reportingJob } from "../lib/alerting"
import { isLockBusyError } from "../lib/click-collect"
import { deliverEmail } from "../lib/email/deliver"
import { safeErrorMessage } from "../lib/email/safe-error"
import { checkSmtpAtStart, smtpOptionsOf } from "../lib/email/smtp-check"
import { sweepFailedEmails, type SweepDeps } from "../lib/email/sweeper"

/**
 * Every 10 minutes: send again the emails that failed (for up to a day), and
 * tell a person while they keep failing and when one is given up. On the
 * first run after start it also checks that the mail server accepts our login.
 * See lib/email/sweeper for the rules.
 */
async function emailSweeperJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  await checkSmtpAtStart(smtpOptionsOf(container), logger)
  try {
    // One run at a time: a slow run (a mail server timing out) must not overlap the next.
    await container.resolve(Modules.LOCKING).execute(
      "technest-email-sweeper",
      () =>
        sweepFailedEmails(
          {
            notifications: container.resolve(Modules.NOTIFICATION) as unknown as SweepDeps["notifications"],
            deliver: (input) => deliverEmail(container, input),
            logger,
          },
          new Date()
        ),
      { timeout: 1 }
    )
  } catch (e) {
    if (isLockBusyError(e)) return
    // Don't throw from a scheduled job: log, report and try again next run.
    logger.error(`email-sweeper: run failed: ${safeErrorMessage(e)}`)
    reportError(e, { source: "job:email-sweeper" })
  }
}

export default reportingJob("email-sweeper", emailSweeperJob)

export const config = {
  name: "email-sweeper",
  schedule: "3-59/10 * * * *",
}
