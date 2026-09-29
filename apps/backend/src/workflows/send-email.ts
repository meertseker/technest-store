import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { sendEmailOnce, type EmailSend } from "../lib/email/send-email-once"

export type SendEmailInput = EmailSend

const sendEmailStep = createStep(
  {
    name: "technest-send-email",
    // SMTP hiccups retry every 60 s, up to 5 times. Each attempt first checks
    // for an earlier successful send, so a retry never emails twice.
    maxRetries: 5,
    retryInterval: 60,
  },
  async (input: SendEmailInput, { container }) => {
    const result = await sendEmailOnce(
      {
        notifications: container.resolve(Modules.NOTIFICATION),
        locking: container.resolve(Modules.LOCKING),
      },
      input
    )
    return new StepResponse(result)
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
