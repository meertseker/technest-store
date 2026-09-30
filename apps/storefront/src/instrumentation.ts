// Next.js server instrumentation. Sentry is OFF unless SENTRY_DSN is set (runtime env), and the
// SDK is not even loaded then. Errors only: no tracing, no replay, nothing personal collected;
// events are scrubbed in beforeSend / beforeBreadcrumb. See docs/ops/uptime-and-sentry.md.
import type { Instrumentation } from "next"
import { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from "@lib/monitoring/sentry-scrub"

function enabled(): boolean {
  return Boolean(process.env.SENTRY_DSN) && process.env.NEXT_RUNTIME === "nodejs"
}

export async function register() {
  if (!enabled()) {
    return
  }
  const Sentry = await import("@sentry/nextjs")
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    dataCollection: SENTRY_DATA_COLLECTION,
    // tracesSampleRate unset = tracing off (errors only).
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  })
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!enabled()) {
    return
  }
  const Sentry = await import("@sentry/nextjs")
  Sentry.captureRequestError(error, request, context)
}
