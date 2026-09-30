const EMAIL = /[^\s<>"'@]+@[^\s<>"'@]+\.[^\s<>"'@]+/g

/**
 * An error message fit for logs: email addresses are masked. The SMTP
 * provider already rethrows PII-free errors; this also covers errors from
 * anywhere else in an email subscriber (defence in depth).
 */
export function safeErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  return message.replace(EMAIL, "<email>").slice(0, 500)
}
