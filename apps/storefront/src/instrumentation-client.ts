// Browser error reporting. Only when NEXT_PUBLIC_SENTRY_DSN was set at build time, and
// never on /checkout: entry to and exit from /checkout are full document loads, so a
// session that starts elsewhere and enters checkout reloads without Sentry.
// The SDK is imported lazily, so pages pay nothing for it when Sentry is off.
import {
  SENTRY_DATA_COLLECTION,
  scrubBreadcrumb,
  scrubEvent,
  shouldInitBrowserSentry,
} from "@lib/monitoring/sentry-scrub"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (typeof window !== "undefined" && shouldInitBrowserSentry(dsn, window.location.pathname)) {
  import("@sentry/nextjs").then((Sentry) =>
    Sentry.init({
      dsn,
      dataCollection: SENTRY_DATA_COLLECTION,
      tracesSampleRate: 0,
      beforeSend: (event) => scrubEvent(event),
      beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
    })
  )
}
