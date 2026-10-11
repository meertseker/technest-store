import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { deliverEmail, type SendEmailInput } from "../lib/email/deliver"
import type { SendEmailOnceResult } from "../lib/email/send-email-once"
import { sendEmailStepError } from "../lib/email/step-error"

export type { SendEmailInput }

const sendEmailStep = createStep(
  {
    name: "technest-send-email",
    // SMTP hiccups retry every 60 s, up to 5 times. Each attempt reloads the
    // data and first checks for an earlier successful send, so a retry never
    // emails twice. A failure the server would repeat (wrong login, rejected
    // recipient) is not retried here at all. An email still failing is picked
    // up by the email-sweeper job (lib/email/sweeper), which keeps trying for a day.
    maxRetries: 5,
    retryInterval: 60,
  },
  async (input: SendEmailInput, { container }): Promise<StepResponse<SendEmailOnceResult>> => {
    try {
      return new StepResponse(await deliverEmail(container, input))
    } catch (e) {
      throw sendEmailStepError(e, input)
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
