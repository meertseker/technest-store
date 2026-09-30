/**
 * Pounds <-> integer pence for admin forms. Our settings are integer pence
 * (docs/contracts/settings.md); staff type pounds. Convert only here.
 */

/** 2000 -> "£20.00" */
export function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100
  )
}

/** 2000 -> "20.00" (for an input field) */
export function penceToPoundsInput(pence: number): string {
  return (pence / 100).toFixed(2)
}

/**
 * "20", "20.5", "£20.50", " 1,000.00 " -> pence; null when it isn't a
 * non-negative amount with at most 2 decimals. Pure string maths, no floats.
 */
export function poundsInputToPence(input: string): number | null {
  const cleaned = input.trim().replace(/^£/, "").replace(/,/g, "").trim()
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) {
    return null
  }
  const pounds = Number(match[1])
  const pence = Number((match[2] ?? "").padEnd(2, "0"))
  const total = pounds * 100 + pence
  return Number.isSafeInteger(total) ? total : null
}
