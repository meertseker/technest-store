/**
 * Money at the storefront boundary (CLAUDE.md "Money").
 * Medusa returns major units (GBP 3.49 is `3.49`); our own values are integer
 * pence named `*_pence`. Convert only here, never by hand in components.
 */

/** 3.49 -> 349. Rounds away float noise (0.1 + 0.2 style) from Medusa's decimals. */
export function toPence(major: number | null | undefined): number {
  if (typeof major !== "number" || !Number.isFinite(major)) return 0
  return Math.round(major * 100)
}

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })

/** A Medusa amount (major units) as "£3.49". Never divides by 100. */
export function formatGbp(major: number | null | undefined): string {
  return GBP.format(typeof major === "number" && Number.isFinite(major) ? major : 0)
}

/** Integer pence as "£3.49" (always two decimals, for prices next to other prices) */
export function formatPenceExact(pence: number): string {
  return GBP.format(pence / 100)
}
