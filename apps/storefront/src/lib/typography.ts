/**
 * Type scale from docs/specs/design.md section 3, as class strings. Headings
 * and prices use the display face (`font-display`, Bricolage Grotesque); body
 * and UI text stay in Inter. Sizes: H1 28/36, H2 24/32, H3 18/20.
 */
export const displayClass = "font-display text-[36px] font-extrabold leading-[1.02] tracking-[-0.025em] lg:text-[56px]"
export const h1Class = "font-display text-[28px] font-bold leading-[1.1] tracking-[-0.02em] lg:text-[36px]"
export const h2Class = "font-display text-[24px] font-bold leading-[1.1] tracking-[-0.015em] lg:text-[32px]"
export const h3Class = "font-display text-lg font-bold leading-snug tracking-[-0.01em] lg:text-xl"
/** Prices: display face, tabular figures */
export const priceClass = "font-display font-bold tabular-nums tracking-[-0.01em]"
export const leadClass = "max-w-[68ch] text-lg text-muted-foreground"
export const linkClass = "underline underline-offset-4 hover:decoration-2"
/** A standalone link with a 44px tap target */
export const blockLinkClass = "inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:decoration-2"
