/**
 * The message the checkout contact and address step shows for a failed save.
 * The backend answers 401 when the email belongs to a trade account and its
 * owner isn't the one signed in; every other error keeps its own message.
 */
export function addressErrorMessage(e: unknown): string {
  if ((e as { status?: unknown } | null)?.status === 401) {
    return "This email belongs to a trade account. Sign in to use this email, or enter a different one."
  }
  return e instanceof Error ? e.message : String(e)
}
