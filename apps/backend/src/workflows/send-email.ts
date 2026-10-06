import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { reportError } from "../lib/alerting"
import { deliverEmail, type SendEmailInput } from "../lib/email/deliver"
import { isSmtpSendFailure } from "../lib/email/safe-error"
import type { SendEmailOnceResult } from "../lib/email/send-email-once"

export type { SendEmailInput }

const sendEmailStep = createStep(
  {
    name: "technest-send-email",
    // SMTP hiccups retry every 60 s, up to 5 times. Each attempt reloads the
    // data and first checks for an earlier successful send, so a retry never
    // emails twice. An email still failing after that is picked up by the
    // email-sweeper job (lib/email/sweeper), which keeps trying for a day.
    maxRetries: 5,
    retryInterval: 60,
  },
  async (input: SendEmailInput, { container }): Promise<StepResponse<SendEmailOnceResult>> => {
    try {
      return new StepResponse(await deliverEmail(container, input))
    } catch (e) {
      // A failed send is stored, retried and alerted on by the sweeper. Anything
      // else (the order can't be loaded, the lock is stuck) leaves no trace
      // for it to find, so report it here. Ids only.
      if (!isSmtpSendFailure(e)) {
        reportError(e, {
          source: "workflow:send-email",
          template: input.template,
          resource_type: input.resource_type,
          resource_id: input.resource_id,
        })
      }
      throw e
    }
  }
  // No compensation: an email can't be unsent.
)

export const sendEmailWorkflow = createWorkflow(
  "send-email",
  function (input: SendEmailInput) {
    const result = sendEmailStep(input)
    return new WorkflowResponse(result)
  }
)
