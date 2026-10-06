import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { reportAlert } from "../alerting"
import { checkSmtpLogin, type SmtpOptions } from "../../modules/smtp/service"

type Check = (options: SmtpOptions) => Promise<{ ok: true } | { ok: false; summary: string }>

let state: "unknown" | "ok" | "failing" = "unknown"

export function resetSmtpCheckForTests() {
  state = "unknown"
}

/** The smtp provider's options as medusa-config.ts gave them to the Notification module. */
export function smtpOptionsOf(container: MedusaContainer): SmtpOptions | null {
  try {
    const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as {
      modules?: Record<string, { options?: { providers?: { id?: string; options?: SmtpOptions }[] } } | boolean>
    }
    const notification = config.modules?.[Modules.NOTIFICATION]
    const providers = typeof notification === "object" ? notification.options?.providers : undefined
    return providers?.find((p) => p.id === "smtp")?.options ?? null
  } catch {
    return null
  }
}

/**
 * Logs in to the mail server once after start (and again on later runs only
 * while that keeps failing). A wrong key, host or port raises an alert within
 * minutes of a deploy instead of at the first order. Never throws.
 */
export async function checkSmtpAtStart(
  options: SmtpOptions | null,
  logger: Pick<Logger, "info" | "warn" | "error">,
  check: Check = checkSmtpLogin
): Promise<void> {
  if (state === "ok") return
  if (!options) {
    logger.warn("smtp: start-up check skipped, the provider's options were not found")
    state = "ok"
    return
  }
  const result = await check(options).catch(() => ({ ok: false as const, summary: "check could not run" }))
  if (result.ok) {
    logger.info(state === "failing" ? "smtp: the mail server accepts our login again" : "smtp: connection and login verified")
    state = "ok"
    return
  }
  const message =
    `smtp: the mail server refused the start-up check (${result.summary}). ` +
    "No email will be sent until this is fixed: check SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS."
  logger.error(message)
  // One alert per outage, not one per run.
  if (state !== "failing") reportAlert(message, { source: "job:email-sweeper" }, "smtp-start-check")
  state = "failing"
}
