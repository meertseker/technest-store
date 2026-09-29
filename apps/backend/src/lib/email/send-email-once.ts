import { createHash } from "node:crypto"
import type { ILockingModule, INotificationModuleService } from "@medusajs/framework/types"

export type EmailSend = {
  to: string
  /** Template id from docs/contracts/emails.md (rendered by @technest/emails). */
  template: string
  data: Record<string, unknown>
  /** The entity the email is about; with template + to it identifies the email. */
  resource_id: string
  resource_type?: string
  trigger_type?: string
  /**
   * Pre-rendered email. Use it for secrets (e.g. reset tokens): the
   * Notification module stores `data` but not `content`.
   */
  content?: { subject: string; html?: string; text?: string }
}

export type SendEmailOnceResult = { id?: string; skipped?: true }

/**
 * Sends an email at most once per (template, resource, recipient).
 *
 * We deliberately don't use the Notification module's idempotency_key: in
 * 2.21.2 its resend of a FAILURE key sends the email but then fails to update
 * the row, so every step retry would email the customer again. Instead we
 * check for an earlier success ourselves, under a lock, and create a fresh
 * (un-keyed) notification per attempt. Failed attempts stay as FAILURE rows.
 */
export async function sendEmailOnce(
  deps: {
    notifications: Pick<INotificationModuleService, "listNotifications" | "createNotifications">
    locking: Pick<ILockingModule, "execute">
  },
  send: EmailSend
): Promise<SendEmailOnceResult> {
  // Hash the recipient: lock errors ("Failed to acquire lock for key …") are
  // logged and lock keys sit in Redis, so they must not contain an address.
  const recipient = createHash("sha256").update(send.to.toLowerCase()).digest("hex").slice(0, 16)
  const lockKey = `email:${send.template}:${send.resource_id}:${recipient}`
  return deps.locking.execute(lockKey, async () => {
    const earlier = await deps.notifications.listNotifications({
      to: send.to,
      template: send.template,
      resource_id: send.resource_id,
    })
    const sent = earlier.find((n) => n.status === "success")
    if (sent) {
      return { skipped: true as const, id: sent.id }
    }
    const [notification] = await deps.notifications.createNotifications([
      { ...send, channel: "email" },
    ])
    return { id: notification?.id }
  })
}
