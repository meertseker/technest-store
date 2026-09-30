// Reads the shared dev Mailpit (SMTP 1025, API 8025). Tests use unique
// addresses per run so they only see their own mail. Never delete the mailbox.
const MAILPIT_API = process.env.MAILPIT_API_URL || "http://localhost:8025/api/v1"

export type MailpitMessage = { ID: string; Subject: string }

/**
 * Polls until `to` has at least `expected` messages (or ~10 s pass), newest
 * first. `ignore` drops messages by subject before counting, e.g. the
 * "Order confirmed" email the real order.placed subscriber sends in the
 * background when a test places an order.
 */
export async function mailTo(
  to: string,
  expected: number,
  opts: { ignore?: RegExp } = {}
): Promise<MailpitMessage[]> {
  let messages: MailpitMessage[] = []
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:"${to}"`)}`)
    messages = ((await res.json()) as { messages?: MailpitMessage[] }).messages ?? []
    if (opts.ignore) messages = messages.filter((m) => !opts.ignore!.test(m.Subject))
    if (messages.length >= expected) break
    await new Promise((r) => setTimeout(r, 250))
  }
  return messages
}

export async function textOf(id: string): Promise<string> {
  const res = await fetch(`${MAILPIT_API}/message/${id}`)
  return ((await res.json()) as { Text: string }).Text
}

/** Waits long enough for an email that should NOT arrive, then returns what did. */
export async function settle(to: string, ms = 2000, opts: { ignore?: RegExp } = {}) {
  await new Promise((r) => setTimeout(r, ms))
  return mailTo(to, 0, opts)
}

/** The confirmation the real order.placed subscriber sends for orders placed in a test. */
export const ORDER_CONFIRMED = /^Order confirmed: /
