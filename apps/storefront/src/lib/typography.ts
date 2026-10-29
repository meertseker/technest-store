/**
 * Type scale from docs/specs/design.md section 3, as class strings. One
 * typeface, Inter, for headings, prices, body and UI (the owner asked for a
 * plain, clean face, 2026-10-29); `font-display` resolves to it. Headings are
 * bold, not extra-bold, and only lightly tightened. Sizes: H1 28/36, H2 24/32,
 * H3 18/20.
 */
export const displayClass = "font-display text-[36px] font-bold leading-[1.05] tracking-[-0.02em] lg:text-[56px]"
export const h1Class = "font-display text-[28px] font-bold leading-[1.1] tracking-[-0.02em] lg:text-[36px]"
export const h2Class = "font-display text-[24px] font-bold leading-[1.1] tracking-[-0.015em] lg:text-[32px]"
export const h3Class = "font-display text-lg font-bold leading-snug tracking-[-0.01em] lg:text-xl"
/** Prices: display face, tabular figures */
export const priceClass = "font-display font-bold tabular-nums tracking-[-0.01em]"
export const leadClass = "max-w-[68ch] text-lg text-muted-foreground"
export const linkClass = "underline underline-offset-4 hover:decoration-2"
/** A standalone link with a 44px tap target */
export const blockLinkClass = "inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:decoration-2"
