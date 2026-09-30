/**
 * PII / secret scrubbing for Sentry events, used as `beforeSend` / `beforeBreadcrumb`.
 * Rule (CLAUDE.md): never send card data, Stripe secrets or customer PII.
 *
 * Layers: (1) `SENTRY_DATA_COLLECTION` stops the SDK collecting personal data at the source,
 * (2) this file removes whatever still gets through, (3) Sentry's server-side Data Scrubber.
 *
 * TWO IDENTICAL COPIES: apps/backend/src/lib/monitoring/sentry-scrub.ts and
 * apps/storefront/src/lib/monitoring/sentry-scrub.ts. The backend unit test
 * `sentry-scrub.unit.spec.ts` fails if they differ. No imports, so it runs in Node, Edge and the browser.
 */

export const FILTERED = "[Filtered]"

/**
 * Sentry v11 `dataCollection`: collect nothing personal at the source
 * (v11 replaced `sendDefaultPii` with this option).
 */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ["user-agent", "content-type", "accept"] }, response: false },
  httpBodies: [] as never[],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  // Local variables in stack frames can hold anything (a cart, an address, a card token).
  stackFrameVariables: false,
}

/** Request headers we keep; everything else (auth, cookies, API keys, client IPs, referer) is dropped. */
const ALLOWED_HEADERS = new Set(["user-agent", "content-type", "accept", "content-length", "host"])

/** Keys dropped from breadcrumb data outright. */
const DROPPED_BREADCRUMB_KEYS = new Set(["body", "request_body", "response_body", "http.query", "http.fragment"])

/** Breadcrumb data keys that hold URLs: their query string and fragment are removed. */
const URL_KEYS = new Set(["url", "to", "from", "http.url"])

// Keys (normalised: lower case, letters and digits only) whose values are always filtered.
const SENSITIVE_KEY_PARTS = [
  "email",
  "phone",
  "mobile",
  "password",
  "passwd",
  "secret",
  "token",
  "authorization",
  "cookie",
  "session",
  "address",
  "postcode",
  "postalcode",
  "zip",
  "card",
  "cvc",
  "cvv",
  "iban",
  "sortcode",
  "accountnumber",
  "apikey",
  "privatekey",
  "signature",
]
const SENSITIVE_KEYS = new Set([
  "name",
  "firstname",
  "lastname",
  "fullname",
  "givenname",
  "familyname",
  "customername",
  "contactname",
  "company",
  "companyname",
  "recipient",
  "city",
  "province",
  "county",
  "street",
  "line1",
  "line2",
  "number",
  "expmonth",
  "expyear",
  "expiry",
  "ip",
  "clientip",
  "sid",
  "connectsid",
])

export function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "")
  return SENSITIVE_KEYS.has(k) || SENSITIVE_KEY_PARTS.some((part) => k.includes(part))
}

// "key": "value", key=value, key: value inside free text (JSON dumps, log lines, form bodies).
const KV_KEY =
  "[A-Za-z_.-]*(?:email|phone|mobile|password|secret|token|authorization|cookie|address|postcode|postal_code|card|cvc|cvv)[A-Za-z0-9_.-]*" +
  "|first_?name|last_?name|full_?name|customer_?name|name|company|city|province|line1|line2|number|exp_month|exp_year"
const KV_RE = new RegExp(
  `(["']?)\\b(${KV_KEY})\\1(\\s*[:=]\\s*)("(?:[^"\\\\]|\\\\.)*"|'[^']*'|[^\\s,&;}\\]]+)`,
  "gi"
)

function luhnValid(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) {
        d -= 9
      }
    }
    sum += d
  }
  return sum % 10 === 0
}

type Replacer = (match: string, ...groups: string[]) => string
type Rule = [RegExp, string | Replacer]

const RULES: Rule[] = [
  // Secrets first, so their digits are not caught by the card / phone rules.
  // Stripe secret, restricted and ephemeral keys; Medusa secret API keys (sk_<hex>).
  [/\b(?:sk|rk|ek)_(?:(?:live|test)_)?[A-Za-z0-9]{8,}/g, "[secret]"],
  [/\bwhsec_[A-Za-z0-9]+/g, "[secret]"],
  // PaymentIntent / SetupIntent client secrets (pi_..._secret_...) and Checkout Session ids.
  [/\b[a-z]{2,4}_[A-Za-z0-9]+_secret_[A-Za-z0-9]+/g, "[secret]"],
  [/\bcs_(?:live|test)_[A-Za-z0-9]+/g, "[secret]"],
  [/\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [secret]"],
  [/\b(Basic)\s+[A-Za-z0-9+/]{8,}={0,2}/g, "$1 [secret]"],
  // JWTs (Medusa auth tokens).
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, "[secret]"],
  // Cookie pairs: Medusa session / cart cookies and Stripe's.
  [/\b(connect\.sid|_medusa_[A-Za-z_]+|__stripe_[A-Za-z]+)=[^;\s]+/g, `$1=${FILTERED}`],
  // Every query-string value (tokens, emails, reset links, cart ids).
  [/([?&])([^=&\s#"'?]+)=[^&\s#"']*/g, `$1$2=${FILTERED}`],
  // Named fields in free text: "email":"...", first_name=..., "address_1": "...".
  // (Values that are already a placeholder, e.g. from the query rule above, are left as they are.)
  [KV_RE, (m, q, key, sep, value) => (/^["']?\[/.test(value) ? m : `${q}${key}${q}${sep}"${FILTERED}"`)],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  // 13-19 digit card numbers (spaces or dashes allowed), only when the Luhn check passes.
  [/\b(?:\d[ -]?){12,18}\d\b/g, (m) => (luhnValid(m.replace(/\D/g, "")) ? "[card]" : m)],
  // Phone numbers: 07xxx xxxxxx, 020 xxxx xxxx, +44 (0)7xxx xxxxxx, 0044 ..., other +CC numbers.
  [/(?:(?:\+|\b00)\d{1,3}[\s-]?(?:\(0\)\s?)?|\b0)\d{2,4}[\s-]?\d{3,4}[\s-]?\d{2,4}\b/g, "[phone]"],
  // UK postcodes (SE16 3TU, W1A 1AA, se163tu).
  [/\b(?:[A-Z]{1,2}\d[A-Z\d]?|GIR)\s?\d[A-Z]{2}\b/gi, "[postcode]"],
  // IPv4 addresses.
  [/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, "[ip]"],
]

/** Longer strings are cut first, which also bounds the regex work per string. */
const MAX_TEXT_LENGTH = 8192

export function scrubText(input: string): string {
  let out = input.length > MAX_TEXT_LENGTH ? `${input.slice(0, MAX_TEXT_LENGTH)}...[truncated]` : input
  for (const [re, replacement] of RULES) {
    out = typeof replacement === "string" ? out.replace(re, replacement) : out.replace(re, replacement)
  }
  return out
}

/** Removes the query string and fragment of a URL (absolute or relative), then scrubs the rest. */
export function stripQuery(url: string): string {
  const i = url.search(/[?#]/)
  return scrubText(i === -1 ? url : url.slice(0, i))
}

/** Recursively scrubs plain data: sensitive keys are filtered, strings are scrubbed. */
export function scrubValue<T>(value: T, depth = 0): T {
  if (value == null) {
    return value
  }
  if (depth > 8) {
    return FILTERED as unknown as T
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
      out[k] = isSensitiveKey(k) ? FILTERED : scrubValue(v, depth + 1)
    }
    return out as T
  }
  return value
}

type Data = Record<string, unknown>
type Breadcrumb = { message?: string; data?: Data }

export function scrubBreadcrumb<B extends Breadcrumb>(crumb: B): B {
  const out: B = { ...crumb }
  if (typeof out.message === "string") {
    out.message = scrubText(out.message)
  }
  if (out.data) {
    const data: Data = {}
    for (const [k, v] of Object.entries(out.data)) {
      if (DROPPED_BREADCRUMB_KEYS.has(k)) {
        continue
      }
      if (URL_KEYS.has(k) && typeof v === "string") {
        data[k] = stripQuery(v)
      } else {
        data[k] = isSensitiveKey(k) ? FILTERED : scrubValue(v)
      }
    }
    out.data = data
  }
  return out
}

type Frame = Data & { vars?: unknown }
type Stacktrace = { frames?: Frame[] }
type ExceptionValue = Data & { value?: unknown; stacktrace?: Stacktrace }

function scrubStacktrace(stacktrace: Stacktrace | undefined): Stacktrace | undefined {
  if (!stacktrace?.frames) {
    return stacktrace
  }
  return {
    ...stacktrace,
    frames: stacktrace.frames.map((frame) => {
      const rest: Frame = { ...frame }
      delete rest.vars
      return rest
    }),
  }
}

function scrubRequest(request: Data): Data {
  const req: Data = { ...request }
  delete req.cookies
  delete req.data
  delete req.query_string
  delete req.env
  if (typeof req.url === "string") {
    req.url = stripQuery(req.url)
  }
  if (req.headers && typeof req.headers === "object") {
    const headers: Data = {}
    for (const [k, v] of Object.entries(req.headers as Data)) {
      if (ALLOWED_HEADERS.has(k.toLowerCase())) {
        headers[k] = typeof v === "string" ? scrubText(v) : v
      }
    }
    req.headers = headers
  }
  return req
}

/** Loosely typed so it works with any Sentry SDK version's Event type. */
export function scrubEvent<E extends object>(event: E): E {
  const out: Data = { ...(event as Data) }

  const user = out.user as Data | undefined
  if (user) {
    if (typeof user.id === "string" || typeof user.id === "number") {
      out.user = { id: scrubText(String(user.id)) }
    } else {
      delete out.user
    }
  }

  if (out.request && typeof out.request === "object") {
    out.request = scrubRequest(out.request as Data)
  }

  if (typeof out.message === "string") {
    out.message = scrubText(out.message)
  }
  if (typeof out.transaction === "string") {
    out.transaction = stripQuery(out.transaction)
  }
  if (out.logentry) {
    out.logentry = scrubValue(out.logentry)
  }

  const exception = out.exception as { values?: ExceptionValue[] } | undefined
  if (exception?.values) {
    out.exception = {
      ...exception,
      values: exception.values.map((v) => ({
        ...v,
        value: typeof v.value === "string" ? scrubText(v.value) : v.value,
        stacktrace: scrubStacktrace(v.stacktrace),
      })),
    }
  }
  const threads = out.threads as { values?: (Data & { stacktrace?: Stacktrace })[] } | undefined
  if (threads?.values) {
    out.threads = {
      ...threads,
      values: threads.values.map((t) => ({ ...t, stacktrace: scrubStacktrace(t.stacktrace) })),
    }
  }

  if (Array.isArray(out.breadcrumbs)) {
    out.breadcrumbs = (out.breadcrumbs as Breadcrumb[]).map((b) => scrubBreadcrumb(b))
  }
  for (const key of ["extra", "contexts", "tags"]) {
    if (out[key]) {
      out[key] = scrubValue(out[key])
    }
  }
  return out as E
}
