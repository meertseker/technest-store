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

/**
 * A failed send the mail server will answer the same way next minute: a wrong
 * login (EAUTH) or any 5xx reply (a rejected recipient or sender, a message
 * refused for good). Retrying it in a minute changes nothing, so the send
 * step gives up at once; the email-sweeper still tries again later (over a
 * day, with a growing wait) in case the login or the quota is fixed, and
 * tells a person meanwhile. Anything else (4xx, timeouts, refused
 * connections) is worth the step's own quick retries.
 */
export function isPermanentSmtpFailure(e: unknown): boolean {
  if (!isSmtpSendFailure(e)) return false
  const message = String((e as { message?: unknown } | undefined)?.message ?? e)
  if (/\bcode=EAUTH\b/.test(message)) return true
  const response = Number(/\bresponse_code=(\d{3})\b/.exec(message)?.[1])
  return response >= 500 && response < 600
}
