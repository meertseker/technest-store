// Next.js server instrumentation. Sentry is OFF unless SENTRY_DSN is set (runtime env).
// Errors only: no tracing, no replay, no default PII. See docs/ops/uptime-and-sentry.md.
import { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from "@lib/monitoring/sentry-scrub"

export async function register() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") {
    return
  }
  const Sentry = await import("@sentry/nextjs")
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    dataCollection: SENTRY_DATA_COLLECTION,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  })
}

export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN || process.env.NEXT_RUNTIME !== "nodejs") {
    return
  }
  const Sentry = await import("@sentry/nextjs")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Sentry.captureRequestError as (...a: any[]) => void)(...args)
}
