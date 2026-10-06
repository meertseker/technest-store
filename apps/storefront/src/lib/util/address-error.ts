/**
 * Saving an email on the basket is refused with a 401 when the email belongs to
 * a trade account and its owner isn't the one signed in. The checkout contact
 * step shows this instead of its generic "something went wrong".
 */
export const TRADE_ACCOUNT_EMAIL_MESSAGE =
  "This email belongs to a trade account. Sign in to use this email, or enter a different one."

export function isTradeAccountEmailRefusal(e: unknown): boolean {
  return (e as { status?: unknown } | null)?.status === 401
}
