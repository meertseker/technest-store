import "server-only"
import { cookies } from "next/headers"
import { allowsAnalytics, CONSENT_COOKIE, parseConsent } from "./consent"

/** The visitor's stored cookie choice, or null if they have not chosen yet */
export async function getConsent() {
  const store = await cookies()
  return parseConsent(store.get(CONSENT_COOKIE)?.value)
}

/** Gate for any future analytics: false until the visitor pressed "Accept" */
export async function hasAnalyticsConsent() {
  return allowsAnalytics(await getConsent())
}
