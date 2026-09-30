/**
 * Pure selection rules for the home page (docs/specs/design.md 7.1). The data
 * comes from the backend; these functions only choose and order it, so they
 * are unit-tested without a server.
 */

export type CategoryLike = {
  id: string
  name: string
  handle: string
  rank?: number | null
  parent_category_id?: string | null
}

export type PricedProductLike = {
  id: string
  created_at?: string | Date | null
  metadata?: Record<string, unknown> | null
  categories?: { handle: string }[] | null
  variants?: { calculated_price?: { calculated_amount?: number | null } | null }[] | null
}

/** The £1 range: its category handle in the seed/admin, or the add-on flag */
export const ONE_POUND_CATEGORY = "1-deals"
/** "Under £5" means strictly below £5.00 (Medusa prices are major units) */
export const UNDER_PRICE = 5

const byRank = (a: CategoryLike, b: CategoryLike) =>
  (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name)

/**
 * Category tiles: the sub-categories of each top-level category, taken in
 * turns (one from each parent, by rank) so the tiles mix cases, audio, gaming
 * and computing rather than filling up with one department. A top-level
 * category without children is a tile itself. The £1 range is left out: it
 * has its own section.
 */
export function pickCategoryTiles<T extends CategoryLike>(categories: T[], count = 8): T[] {
  const parents = categories
    .filter((c) => !c.parent_category_id && c.handle !== ONE_POUND_CATEGORY)
    .sort(byRank)
  const queues = parents.map((p) => {
    const children = categories.filter((c) => c.parent_category_id === p.id).sort(byRank)
    return children.length ? children : [p]
  })
  const out: T[] = []
  for (let i = 0; out.length < count && queues.some((q) => i < q.length); i++) {
    for (const q of queues) {
      if (i < q.length && out.length < count) out.push(q[i])
    }
  }
  return out
}

/** Cheapest calculated price of a product (major units), or null without prices */
export function minPrice(p: PricedProductLike): number | null {
  const prices = (p.variants ?? [])
    .map((v) => v.calculated_price?.calculated_amount)
    .filter((n): n is number => typeof n === "number")
  return prices.length ? Math.min(...prices) : null
}

export const isOnePoundItem = (p: PricedProductLike) =>
  p.metadata?.is_addon_item === true ||
  !!p.categories?.some((c) => c.handle === ONE_POUND_CATEGORY)

/** £1 tab: the £1 range, newest first */
export function pickOnePound<T extends PricedProductLike>(products: T[], count = 4): T[] {
  return newestFirst(products.filter(isOnePoundItem)).slice(0, count)
}

/** Under £5 tab: priced below £5 and not in the £1 range (that has its own tab), cheapest first */
export function pickUnderFive<T extends PricedProductLike>(products: T[], count = 4): T[] {
  return products
    .filter((p) => !isOnePoundItem(p))
    .map((p) => ({ p, price: minPrice(p) }))
    .filter((x): x is { p: T; price: number } => x.price !== null && x.price < UNDER_PRICE)
    .sort((a, b) => a.price - b.price)
    .slice(0, count)
    .map((x) => x.p)
}

const time = (d: PricedProductLike["created_at"]) => (d ? new Date(d).getTime() || 0 : 0)

export function newestFirst<T extends PricedProductLike>(products: T[]): T[] {
  return [...products].sort((a, b) => time(b.created_at) - time(a.created_at))
}

/** "New in" (the fallback for best sellers): newest priced items, £1 add-ons left out */
export function pickNewIn<T extends PricedProductLike>(products: T[], count = 4): T[] {
  return newestFirst(products.filter((p) => !isOnePoundItem(p) && minPrice(p) !== null)).slice(
    0,
    count
  )
}

export type DealsTab = "one-pound" | "under-5"

/** ?deals=under-5 selects the second tab; anything else is the £1 tab */
export const parseDealsTab = (v: unknown): DealsTab => (v === "under-5" ? "under-5" : "one-pound")

/** "£3.99", "£1", "£12.50": pounds are shown whole only when there are no pence */
export function formatGbp(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)
}
