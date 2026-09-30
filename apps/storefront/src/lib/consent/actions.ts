"use server"

import { cookies } from "next/headers"
import { CONSENT_COOKIE, consentCookieOptions, parseConsent } from "./consent"

/**
 * Stores "accepted" or "rejected" from the banner or the cookie policy page.
 * A plain form post, so it also works without JavaScript. Setting a cookie in
 * a server action makes Next.js re-render the page, which hides the banner.
 */
export async function saveConsent(formData: FormData) {
  const choice = parseConsent(formData.get("choice"))
  if (!choice) return
  const store = await cookies()
  store.set(CONSENT_COOKIE, choice, consentCookieOptions(process.env.NODE_ENV === "production"))
}
