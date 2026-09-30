/**
 * Turns Medusa auth errors (FetchError messages, stringified) into plain
 * words. Anything unknown gets a generic message: raw backend text is never
 * shown, and it may contain the email address.
 */
export function loginErrorMessage(raw: string): string {
  if (/invalid email or password|unauthorized|incorrect/i.test(raw)) {
    return "The email address or password is incorrect. Check them and try again, or reset your password."
  }
  if (/fetch failed|ECONNREFUSED|network|No response/i.test(raw)) {
    return "We could not reach our system just now. Please try again in a minute."
  }
  return "Sorry, we could not sign you in. Please try again, or call the shop if it keeps happening."
}

export function registerErrorMessage(raw: string): string {
  if (/already exists/i.test(raw) || /invalid email or password/i.test(raw)) {
    return "An account with this email address already exists. Sign in instead, or reset your password."
  }
  if (/fetch failed|ECONNREFUSED|network|No response/i.test(raw)) {
    return "We could not reach our system just now. Please try again in a minute."
  }
  return "Sorry, we could not create your account. Please try again, or call the shop if it keeps happening."
}
