// Loaded by `medusa start` / `medusa develop` before the app boots (Medusa calls register()).
// Sentry is OFF unless SENTRY_DSN is set. PII is scrubbed before anything leaves the process.
import { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from "./src/lib/monitoring/sentry-scrub"

export function register() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    return
  }
  // Required lazily so dev and tests never load the SDK.
  const Sentry = require("@sentry/node") as typeof import("@sentry/node")
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE,
    dataCollection: SENTRY_DATA_COLLECTION,
    // No tracesSampleRate: leaving it unset keeps tracing off (errors only, free tier).
    initialScope: { tags: { medusa_worker_mode: process.env.MEDUSA_WORKER_MODE || "shared" } },
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  })
}
