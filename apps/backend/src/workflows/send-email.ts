import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { sendEmailOnce, type SendEmailOnceResult } from "../lib/email/send-email-once"
import { resolveEmail, type EmailRecipient } from "../lib/email/sources"

/**
 * IDs only. The workflow engine persists workflow inputs (workflow_execution
 * table, Redis) because this step retries on an interval, so no addresses,
 * order contents or secrets may go in here (security review 2026-09-30).
 * Secrets such as reset tokens never use this workflow at all.
 */
export type SendEmailInput = {
  template: string
  resource_id: string
  resource_type: string
  trigger_type: string
  recipient: EmailRecipient
  /** Extra non-PII entity ids the template needs (e.g. low-stock variant ids). */
  ids?: string[]
}

const sendEmailStep = createStep(
  {
    name: "technest-send-email",
    // SMTP hiccups retry every 60 s, up to 5 times. Each attempt reloads the
    // data and first checks for an earlier successful send, so a retry never
    // emails twice.
    maxRetries: 5,
    retryInterval: 60,
  },
  async (input: SendEmailInput, { container }): Promise<StepResponse<SendEmailOnceResult>> => {
    const resolved = await resolveEmail(
      container,
      input.template,
      input.resource_id,
      input.recipient,
      input.ids
    )
    if (!resolved) {
      return new StepResponse<SendEmailOnceResult>({ skipped: true })
    }
    const result = await sendEmailOnce(
      {
        notifications: container.resolve(Modules.NOTIFICATION),
        locking: container.resolve(Modules.LOCKING),
      },
      {
        ...resolved,
        template: input.template,
        resource_id: input.resource_id,
        resource_type: input.resource_type,
        trigger_type: input.trigger_type,
      }
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
