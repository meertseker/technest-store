import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

export type SendEmailInput = {
  to: string
  /** Template id from docs/contracts/emails.md (rendered by @technest/emails). */
  template: string
  data: Record<string, unknown>
  /** "<template>:<entity id>". The Notification module skips keys already sent. */
  idempotency_key: string
  resource_id?: string
  resource_type?: string
  trigger_type?: string
}

const sendEmailStep = createStep(
  {
    name: "technest-send-email",
    // SMTP hiccups retry every 60 s, up to 5 times. Retries reuse the same
    // idempotency key, so the Notification module only resends failed ones.
    maxRetries: 5,
    retryInterval: 60,
  },
  async (input: SendEmailInput, { container }) => {
    const notifications = container.resolve(Modules.NOTIFICATION)
    const [notification] = await notifications.createNotifications([
      { ...input, channel: "email" },
    ])
    return new StepResponse({ id: notification?.id })
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
