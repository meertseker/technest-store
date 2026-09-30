import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendEmailWorkflow, type SendEmailInput } from "../../workflows/send-email"

/**
 * Runs the send-email workflow for one email and never throws: a failed
 * email must not fail the subscriber (other emails for the same event still
 * go out). Logs ids only, never addresses or content.
 */
export async function runEmail(container: MedusaContainer, input: SendEmailInput) {
  try {
    await sendEmailWorkflow(container).run({ input })
  } catch (e) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `${input.trigger_type} email failed: template=${input.template} ${input.resource_type}=${input.resource_id}: ${(e as Error).message}`
      )
  }
}
