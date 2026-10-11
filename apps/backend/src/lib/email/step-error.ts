import { PermanentStepFailureError } from "@medusajs/framework/orchestration"
import { reportError } from "../alerting"
import { isPermanentSmtpFailure, isSmtpSendFailure, safeErrorMessage } from "./safe-error"

type Ids = { template: string; resource_type: string; resource_id: string }

/**
 * What the send-email step throws for a failed attempt.
 *  - A permanent SMTP failure becomes a PermanentStepFailureError: the
 *    workflow engine marks the step failed without using its retries. The
 *    message keeps the send-failed marker, so callers still treat it as a
 *    stored failure (the sweeper's job) and do not report it twice.
 *  - A temporary SMTP failure is rethrown as it is: the step retries.
 *  - Anything else failed before an attempt was stored (the order can't be
 *    loaded, the lock is stuck), so nothing is left for the sweeper to find:
 *    report it here, ids only, then rethrow.
 */
export function sendEmailStepError(e: unknown, input: Ids): unknown {
  if (isPermanentSmtpFailure(e)) {
    return new PermanentStepFailureError(safeErrorMessage(e))
  }
  if (!isSmtpSendFailure(e)) {
    reportError(e, {
      source: "workflow:send-email",
      template: input.template,
      resource_type: input.resource_type,
      resource_id: input.resource_id,
    })
  }
  return e
}
