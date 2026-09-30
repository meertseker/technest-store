/**
 * UK postcode check (spec 7.5): a format regex first, then postcodes.io.
 * The regex is the GOV.UK-style pattern (outward code + inward code), and
 * accepts GIR 0AA. BFPO addresses are out of scope for delivery.
 */
const UK_POSTCODE =
  /^(GIR ?0AA|(?:[A-PR-UWYZ][0-9][0-9]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9]?|[A-PR-UWYZ][0-9][A-HJKPSTUW]|[A-PR-UWYZ][A-HK-Y][0-9][ABEHMNPRVWXY]) ?[0-9][ABD-HJLNP-UW-Z]{2})$/

/** " se16 3tu " -> "SE16 3TU"; returns the input trimmed/uppercased if it can't be split */
export function normalisePostcode(input: string): string {
  const compact = input.replace(/\s+/g, "").toUpperCase()
  if (compact.length < 5 || compact.length > 7) return input.trim().toUpperCase()
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`
}

export function isValidUkPostcode(input: string): boolean {
  return UK_POSTCODE.test(normalisePostcode(input))
}

/**
 * postcodes.io lookup (server side, so /checkout's CSP stays Stripe-only).
 * Returns false only when postcodes.io positively says the postcode doesn't
 * exist; a network error or timeout never blocks the order.
 */
export async function postcodeExists(
  postcode: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  try {
    const res = await fetchImpl(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(normalisePostcode(postcode))}/validate`,
      { signal: AbortSignal.timeout(2500), cache: "no-store" }
    )
    if (!res.ok) return true
    const body = (await res.json()) as { result?: unknown }
    return body.result !== false
  } catch {
    return true
  }
}
