/** Cookie consent rules (pure; safe to import anywhere). See /legal/cookies. */
export const CONSENT_COOKIE = "tn_consent"

/** ICO guidance: don't keep a choice forever. We ask again after 6 months. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180

export const CONSENT_CHOICES = ["accepted", "rejected"] as const
export type ConsentChoice = (typeof CONSENT_CHOICES)[number]

/** Anything but an exact known value counts as "not asked yet" */
export const parseConsent = (value: unknown): ConsentChoice | null =>
  CONSENT_CHOICES.includes(value as ConsentChoice) ? (value as ConsentChoice) : null

export const allowsAnalytics = (choice: ConsentChoice | null) => choice === "accepted"

export const consentCookieOptions = (isProduction: boolean) => ({
  maxAge: CONSENT_MAX_AGE,
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: isProduction,
})
