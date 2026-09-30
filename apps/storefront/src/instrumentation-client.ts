// Browser error reporting (Next.js 15.3+ loads this file before the app on every page).
// Off unless NEXT_PUBLIC_SENTRY_DSN was set at build time, and never on /checkout
// (see src/lib/monitoring/sentry-browser.ts). The SDK is a lazy first-party chunk served
// from our own origin, so pages without Sentry never download it.
import {
  browserBeforeBreadcrumb,
  browserBeforeSend,
  shouldInitBrowserSentry,
} from "@lib/monitoring/sentry-browser"
import { SENTRY_DATA_COLLECTION } from "@lib/monitoring/sentry-scrub"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (typeof window !== "undefined" && shouldInitBrowserSentry(dsn, window.location.pathname)) {
  import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        dataCollection: SENTRY_DATA_COLLECTION,
        // Errors only: tracesSampleRate unset = no tracing; no replay integration.
        beforeSend: (event) => browserBeforeSend(event),
        beforeBreadcrumb: (crumb) => browserBeforeBreadcrumb(crumb),
      })
    )
    .catch(() => {
      // Monitoring must never break the shop.
    })
}
