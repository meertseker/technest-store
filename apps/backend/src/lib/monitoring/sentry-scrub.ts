/**
 * PII / secret scrubbing for Sentry events (backend). Applied in `beforeSend` and
 * `beforeBreadcrumb`, on top of `dataCollection` (nothing personal collected) and Sentry's server-side scrubber.
 * Rule: never send card data, Stripe secrets or customer PII (brief, section 4).
 * The storefront has a copy in apps/storefront/src/lib/monitoring/sentry-scrub.ts: keep them in sync.
 */

const PATTERNS: [RegExp, string][] = [
  // Stripe and other secrets first, so their digits are not caught by the card/phone rules.
  [/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+/g, "[secret]"],
  [/\bwhsec_[A-Za-z0-9]+/g, "[secret]"],
  [/\b[a-z]{2,4}_[A-Za-z0-9]+_secret_[A-Za-z0-9]+/g, "[secret]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  // 13-19 digit card numbers, optionally grouped by spaces or dashes.
  [/\b(?:\d[ -]?){12,18}\d\b/g, "[card]"],
  // UK phone numbers: 07xxx xxxxxx, +44 7xxx xxxxxx, 020 xxxx xxxx ...
  [/(?:\+44\s?|\b0)\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g, "[phone]"],
  // UK postcodes (SE16 3TU, W1A 1AA).
  [/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi, "[postcode]"],
]

/**
 * Sentry v11 `dataCollection` option: collect nothing personal at the source
 * (replaces the old `dataCollection` (nothing personal collected)). The scrubbers below are the second layer.
 */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ["user-agent", "content-type", "accept"] }, response: false },
  httpBodies: [] as never[],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
}

const DROP_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-publishable-api-key",
  "stripe-signature",
  "x-forwarded-for",
  "cf-connecting-ip",
  "x-real-ip",
])

export function scrubText(input: string): string {
  let out = input
  for (const [re, replacement] of PATTERNS) {
    out = out.replace(re, replacement)
  }
  return out
}

function stripQuery(url: string): string {
  const i = url.indexOf("?")
  return i === -1 ? url : url.slice(0, i)
}

/** Recursively scrub strings in plain data (objects, arrays). */
export function scrubValue<T>(value: T, depth = 0): T {
  if (depth > 8 || value == null) {
    return value
  }
  if (typeof value === "string") {
    return scrubText(value) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, depth + 1)) as unknown as T
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubValue(v, depth + 1)
    }
    return out as T
  }
  return value
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Breadcrumb = { message?: string; data?: { [key: string]: any } }

export function scrubBreadcrumb<B extends Breadcrumb>(crumb: B): B {
  const out: B = { ...crumb }
  if (typeof out.message === "string") {
    out.message = scrubText(out.message)
  }
  if (out.data) {
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(out.data)) {
      // Request/response bodies never leave the server.
      if (k === "body" || k === "request_body" || k === "response_body") {
        continue
      }
      data[k] = k === "url" && typeof v === "string" ? stripQuery(v) : scrubValue(v)
    }
    out.data = data
  }
  return out
}

// Loosely typed so the same function works with any Sentry SDK version's Event type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scrubEvent<E extends Record<string, any>>(event: E): E {
  const out: Record<string, any> = { ...event }

  if (out.user) {
    out.user = out.user.id ? { id: out.user.id } : undefined
    if (!out.user) {
      delete out.user
    }
  }

  if (out.request) {
    const req = { ...out.request }
    delete req.cookies
    delete req.data
    delete req.query_string
    if (typeof req.url === "string") {
      req.url = stripQuery(req.url)
    }
    if (req.headers) {
      const headers: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(req.headers as Record<string, unknown>)) {
        if (!DROP_HEADERS.has(k.toLowerCase())) {
          headers[k] = v
        }
      }
      req.headers = headers
    }
    out.request = req
  }

  if (typeof out.message === "string") {
    out.message = scrubText(out.message)
  }
  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v: Record<string, unknown>) => ({
        ...v,
        value: typeof v.value === "string" ? scrubText(v.value) : v.value,
      })),
    }
  }
  if (Array.isArray(out.breadcrumbs)) {
    out.breadcrumbs = out.breadcrumbs.map((b: Breadcrumb) => scrubBreadcrumb(b))
  }
  for (const key of ["extra", "contexts", "tags"]) {
    if (out[key]) {
      out[key] = scrubValue(out[key])
    }
  }
  return out as E
}
