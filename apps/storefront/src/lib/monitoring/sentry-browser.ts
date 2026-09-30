/**
 * Browser-only Sentry rules (storefront). /checkout may load no script other than Stripe's and
 * its CSP (src/lib/checkout-csp.ts) only allows 'self' + Stripe in connect-src, so:
 * 1. the SDK is never initialised on a document whose path is /checkout, and
 * 2. if a page that started elsewhere ever reaches /checkout by client-side navigation,
 *    every event and breadcrumb is dropped there, so nothing is sent from checkout.
 * Entry to and exit from checkout are full page loads by design (cart summary and checkout
 * header use plain <a> links), so (2) is only a safety net.
 */
import { isCheckoutPath } from "@lib/checkout-csp"
import { scrubBreadcrumb, scrubEvent } from "./sentry-scrub"

export function shouldInitBrowserSentry(dsn: string | undefined, pathname: string): boolean {
  return Boolean(dsn) && !isCheckoutPath(pathname)
}

function onCheckout(): boolean {
  return typeof window !== "undefined" && isCheckoutPath(window.location.pathname)
}

export function browserBeforeSend<E extends object>(event: E): E | null {
  return onCheckout() ? null : scrubEvent(event)
}

export function browserBeforeBreadcrumb<B extends { message?: string; data?: Record<string, unknown> }>(
  crumb: B
): B | null {
  return onCheckout() ? null : scrubBreadcrumb(crumb)
}
