// Reads the shared dev Mailpit (SMTP 1025, API 8025). Tests use unique
// addresses per run so they only see their own mail. Never delete the mailbox.
const MAILPIT_API = process.env.MAILPIT_API_URL || "http://localhost:8025/api/v1"

export type MailpitMessage = { ID: string; Subject: string }

/** Polls until `to` has at least `expected` messages (or ~10 s pass). */
export async function mailTo(to: string, expected: number): Promise<MailpitMessage[]> {
  let messages: MailpitMessage[] = []
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:"${to}"`)}`)
    messages = ((await res.json()) as { messages?: MailpitMessage[] }).messages ?? []
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
export async function settle(to: string, ms = 2000) {
  await new Promise((r) => setTimeout(r, ms))
  return mailTo(to, 0)
}
