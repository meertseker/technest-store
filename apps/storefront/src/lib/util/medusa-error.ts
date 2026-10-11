/**
 * Normalises a failed backend call into one Error for the callers of `lib/data`.
 *
 * The Medusa JS SDK throws a `FetchError`: `message` is the backend's own text
 * (written for shoppers where it is a refusal), `status` the HTTP status and
 * `statusText` the reason phrase. Network failures arrive as a plain
 * `TypeError`. The thrown error keeps the message (capitalised, with a full
 * stop) and the status, so callers can tell refusals (4xx) from failures.
 */
type FetchErrorLike = {
  message?: unknown
  status?: unknown
  statusText?: unknown
}

const FALLBACK = "The request failed"

export default function medusaError(error: unknown): never {
  const err = (typeof error === "object" && error !== null ? error : {}) as FetchErrorLike
  const text = typeof error === "string" ? error : firstString(err.message, err.statusText) ?? FALLBACK
  const status = typeof err.status === "number" ? err.status : undefined

  throw Object.assign(new Error(sentence(text)), { status })
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((v): v is string => typeof v === "string" && v.trim().length > 0)?.trim()
}

function sentence(text: string): string {
  const t = text.trim()
  const capitalised = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`
}
