import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { renderEmail, type TemplateId } from "@technest/emails"
import { sendEmailOnce, type SendEmailOnceResult } from "./send-email-once"
import { resolveEmail, type EmailRecipient } from "./sources"

/**
 * IDs only. The workflow engine persists workflow inputs (workflow_execution
 * table, Redis) because the send step retries on an interval, and the same
 * fields are stored with every attempt so a failed email can be tried again
 * later. No addresses, order contents or secrets may go in here (security
 * review 2026-09-30). Secrets such as reset tokens never use this path at all.
 */
export type SendEmailInput = {
  template: string
  resource_id: string
  resource_type: string
  trigger_type: string
  recipient: EmailRecipient
  /** Extra non-PII entity ids the template needs (e.g. low-stock variant ids). */
  ids?: string[]
  /** A deliberate repeat of an email already sent (see sendEmailOnce). Non-personal. */
  send_key?: string
}

/** What is stored with each attempt (notification.data): enough to try again, nothing personal. */
export type StoredEmailInput = Pick<SendEmailInput, "recipient" | "ids" | "send_key">

/**
 * One attempt at one email: load the recipient and data fresh, render, and
 * send unless it already went out. Throws when the attempt failed.
 * `skipped` without an id means there is nothing to send (any more).
 *
 * The email is rendered here and passed as content, so the stored attempt
 * holds no order lines, names or addresses: only the ids to build it again.
 */
export async function deliverEmail(container: MedusaContainer, input: SendEmailInput): Promise<SendEmailOnceResult> {
  const resolved = await resolveEmail(container, input.template, input.resource_id, input.recipient, input.ids)
  if (!resolved) {
    return { skipped: true }
  }
  const content = await renderEmail(input.template as TemplateId, resolved.data)
  const stored: StoredEmailInput = {
    recipient: input.recipient,
    ...(input.ids ? { ids: input.ids } : {}),
    ...(input.send_key ? { send_key: input.send_key } : {}),
  }
  return sendEmailOnce(
    {
      notifications: container.resolve(Modules.NOTIFICATION),
      locking: container.resolve(Modules.LOCKING),
    },
    {
      to: resolved.to,
      content,
      data: stored,
      template: input.template,
      resource_id: input.resource_id,
      resource_type: input.resource_type,
      trigger_type: input.trigger_type,
      ...(input.send_key ? { send_key: input.send_key } : {}),
    }
  )
}
