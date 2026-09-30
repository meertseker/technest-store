import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { renderEmail } from "@technest/emails"
import { createHash } from "node:crypto"
import { storefrontUrl } from "../lib/email/order-email-data"
import { sendEmailOnce } from "../lib/email/send-email-once"

type PasswordResetEvent = {
  /** The login identifier; for emailpass that's the email address. */
  entity_id: string
  actor_type: string
  /** One-time JWT, valid for 15 minutes. Never log or store it. */
  token: string
}

/** Actor types we send resets for, and the app_metadata key that proves the account. */
const ACTORS: Record<string, { idKey: string; audience: "customer" | "staff" }> = {
  customer: { idKey: "customer_id", audience: "customer" },
  user: { idKey: "user_id", audience: "staff" },
}

const RETRY_DELAYS_MS = [2_000, 10_000]

const adminUrl = () =>
  `${(process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/$/, "")}/app`

/**
 * Medusa accepts any actor_type in /auth/{actor}/emailpass/reset-password, so
 * only send when the login really belongs to a customer or staff account.
 */
async function isAccountOfType(container: MedusaContainer, entityId: string, idKey: string) {
  const auth = container.resolve(Modules.AUTH)
  const identities = await auth.listProviderIdentities(
    { entity_id: entityId },
    { relations: ["auth_identity"] }
  )
  return identities.some((i) => !!i.auth_identity?.app_metadata?.[idKey])
}

/**
 * auth.password_reset → reset link for customers (storefront) and staff
 * (Medusa admin). Deliberately NOT via the send-email workflow: its inputs are
 * persisted, and this token is a live credential. The email is rendered here
 * and sent as `content` (not stored in notification.data); retries happen in
 * memory.
 */
export default async function passwordResetEmail({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetEvent>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const requestId = createHash("sha256").update(data.token).digest("hex").slice(0, 16)
  const actor = ACTORS[data.actor_type]
  if (!actor) {
    logger.warn(`password reset for unsupported actor type ignored (request ${requestId})`)
    return
  }

  try {
    if (!(await isAccountOfType(container, data.entity_id, actor.idKey))) {
      logger.warn(`password reset for a login that isn't a ${data.actor_type} ignored (request ${requestId})`)
      return
    }

    const token = encodeURIComponent(data.token)
    const resetUrl =
      actor.audience === "customer"
        ? `${storefrontUrl()}/account/reset-password?token=${token}&email=${encodeURIComponent(data.entity_id)}`
        : `${adminUrl()}/reset-password?token=${token}`
    const content = await renderEmail("password-reset", { reset_url: resetUrl, actor: actor.audience })

    const deps = {
      notifications: container.resolve(Modules.NOTIFICATION),
      locking: container.resolve(Modules.LOCKING),
    }
    const send = {
      to: data.entity_id,
      template: "password-reset",
      data: {},
      content,
      resource_id: `reset_${requestId}`,
      resource_type: "auth",
      trigger_type: "auth.password_reset",
    }
    for (let attempt = 0; ; attempt++) {
      try {
        await sendEmailOnce(deps, send)
        return
      } catch (e) {
        if (attempt >= RETRY_DELAYS_MS.length) throw e
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
      }
    }
  } catch (e) {
    logger.error(`password reset email failed (request ${requestId}): ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
