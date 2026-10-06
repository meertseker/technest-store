import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reportError } from "../alerting"
import { isSmtpSendFailure, safeErrorMessage } from "./safe-error"
import type { SendEmailInput } from "./deliver"
import { sendEmailWorkflow } from "../../workflows/send-email"

/**
 * Runs the send-email workflow for one email and never throws: a failed
 * email must not fail the subscriber (other emails for the same event still
 * go out). Logs ids only, never addresses or content.
 *
 * A send that fails is stored, tried again for a day and alerted on by the
 * email-sweeper job. Anything else that stops the email is reported here.
 */
export async function runEmail(container: MedusaContainer, input: SendEmailInput) {
  try {
    await sendEmailWorkflow(container).run({ input })
  } catch (e) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `${input.trigger_type} email failed: template=${input.template} ${input.resource_type}=${input.resource_id}: ${safeErrorMessage(e)}`
      )
    if (!isSmtpSendFailure(e)) {
      reportError(e, {
        source: `email:${input.trigger_type}`,
        template: input.template,
        resource_type: input.resource_type,
        resource_id: input.resource_id,
      })
    }
  }
}
