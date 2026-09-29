import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { renderEmail } from "@technest/emails"
import { createHash } from "node:crypto"
import { storefrontUrl } from "../lib/email/order-email-data"
import { sendEmailWorkflow } from "../workflows/send-email"

type PasswordResetEvent = {
  /** The login identifier; for emailpass that's the email address. */
  entity_id: string
  actor_type: string
  /** One-time JWT, valid for 15 minutes. Never log or store it. */
  token: string
}

const adminUrl = () =>
  `${(process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/$/, "")}/app`

/**
 * auth.password_reset → reset link for customers (storefront) and staff
 * (Medusa admin). The email is rendered here and sent as `content`, so the
 * token is never persisted in notification.data.
 */
export default async function passwordResetEmail({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetEvent>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const isCustomer = data.actor_type === "customer"
  const token = encodeURIComponent(data.token)
  const resetUrl = isCustomer
    ? `${storefrontUrl()}/account/reset-password?token=${token}&email=${encodeURIComponent(data.entity_id)}`
    : `${adminUrl()}/reset-password?token=${token}`

  // One email per reset request; duplicate deliveries of the same event are skipped.
  const requestId = createHash("sha256").update(data.token).digest("hex").slice(0, 16)
  try {
    const content = await renderEmail("password-reset", {
      reset_url: resetUrl,
      actor: isCustomer ? "customer" : "staff",
    })
    await sendEmailWorkflow(container).run({
      input: {
        to: data.entity_id,
        template: "password-reset",
        data: {},
        content,
        resource_id: `reset_${requestId}`,
        resource_type: "auth",
        trigger_type: "auth.password_reset",
      },
    })
  } catch (e) {
    logger.error(`password reset email failed (request ${requestId}): ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
