import { shouldInitBrowserSentry } from "./sentry-browser"

/**
 * Reports an error that an error boundary caught in the browser. A boundary
 * swallows the error, so the SDK's global handlers never see it.
 *
 * Same rules as src/instrumentation-client.ts: nothing unless
 * NEXT_PUBLIC_SENTRY_DSN was set at build time, and nothing at all on
 * /checkout (the SDK is not even loaded there). Never throws.
 */
export function reportClientError(error: unknown): void {
  if (typeof window === "undefined") return
  if (!shouldInitBrowserSentry(process.env.NEXT_PUBLIC_SENTRY_DSN, window.location.pathname)) return
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureException(error)
    })
    .catch(() => {
      // Monitoring must never break the shop.
    })
}
