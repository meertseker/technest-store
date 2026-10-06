/**
 * Reports a failure that the code handled itself. Form actions and data reads
 * catch backend errors and show a friendly message, so nothing is thrown for
 * Next's `onRequestError` to see; without this an outage would be invisible.
 *
 * Server side only. Off unless SENTRY_DSN is set, exactly like
 * src/instrumentation.ts, whose `beforeSend` scrubs every event (no card data,
 * secrets or personal data leave the server). Never throws.
 */
export async function reportError(error: unknown, where: string): Promise<void> {
  if (!process.env.SENTRY_DSN) return
  try {
    const Sentry = await import("@sentry/nextjs")
    Sentry.captureException(error, { tags: { handled_in: where } })
  } catch {
    // Monitoring must never break the shop.
  }
}

/**
 * A refusal the visitor can act on (wrong password, invalid field, not signed
 * in, not found, too many requests) is expected and not worth an alert.
 * Everything else is: a 5xx, a timeout, a network failure, a bug.
 */
export function isUnexpected(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  return !(typeof status === "number" && status >= 400 && status < 500)
}

/** `reportError`, but only for failures that are not an ordinary refusal */
export async function reportUnexpected(error: unknown, where: string): Promise<void> {
  if (isUnexpected(error)) await reportError(error, where)
}
