/** Starts the message of every send that reached the mail server and failed there (modules/smtp). */
export const SMTP_SEND_FAILED = "smtp: send failed"

/** True for a failed send (stored as a failed attempt), false for anything that went wrong before it. */
export const isSmtpSendFailure = (e: unknown) =>
  String((e as { message?: unknown } | undefined)?.message ?? e).includes(SMTP_SEND_FAILED)

const EMAIL = /[^\s<>"@]+@[^\s<>"'@]+\.[^\s<>"'@]+/g

/**
 * An error message fit for logs: email addresses are masked. The SMTP
 * provider already rethrows PII-free errors; this also covers errors from
 * anywhere else in an email subscriber (defence in depth).
 */
export function safeErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  return message.replace(EMAIL, "<email>").slice(0, 500)
}
