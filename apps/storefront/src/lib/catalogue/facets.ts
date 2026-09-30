/**
 * Listing filters, counts and sorting (docs/specs/design.md 7.2). The shop's
 * catalogue is small (hundreds of products), so a listing loads every product
 * in scope once (cached) and filters on the server; the same pure functions
 * give the filter sheet its live "Show 42 results" count in the browser.
 */
import { connectorsOf, platformLabel, readAttributes, type WithAttributes } from "./attributes"
import {
  FACET_KEYS,
  FACET_LABELS,
  slugify,
  type FacetKey,
  type ListingSort,
  type Selection,
} from "./listing-params"
import { isPurchasable, priceRange, type ProductLike } from "./variants"

export type FacetValues = Partial<Record<FacetKey, string[]>>

/** What the browser needs per product to count results: no prices, titles or PII */
export type FacetIndexItem = { id: string; f: FacetValues }

export type ListingProduct = ProductLike &
  WithAttributes & {
    id: string
    created_at?: string | Date | null
    categories?: { id: string }[] | null
  }

export const PRICE_BANDS = [
  { value: "under-5", label: "Under £5", min: 0, max: 5 },
  { value: "5-10", label: "£5 to £10", min: 5, max: 10 },
  { value: "10-20", label: "£10 to £20", min: 10, max: 20 },
  { value: "20-plus", label: "£20 and over", min: 20, max: Infinity },
] as const

/** Price band of a price in pounds (major units): [min, max) */
export const priceBand = (price: number) =>
  PRICE_BANDS.find((b) => price >= b.min && price < b.max)?.value ?? null

const COLOUR = /^colou?r$/i

/**
 * Sub-category facet: maps every category id in scope to the direct child
 * of the listing's category it sits under (so "Phone Accessories" can be
 * narrowed to Cases or Chargers). Empty for a leaf category.
 */
export type CategoryFacet = Map<string, { value: string; label: string }>

export type Labels = Record<string, string>
const labelKey = (key: FacetKey, value: string) => `${key}:${value}`

export function facetValuesOf(
  p: ListingProduct,
  categoryFacet: CategoryFacet | null,
  labels: Labels
): FacetValues {
  const out: FacetValues = {}
  const add = (key: FacetKey, label: string, value = slugify(label)) => {
    if (!value) return
    const list = (out[key] ??= [])
    if (!list.includes(value)) list.push(value)
    labels[labelKey(key, value)] ??= label
  }

  if (categoryFacet) {
    for (const c of p.categories ?? []) {
      const hit = categoryFacet.get(c.id)
      if (hit) add("category", hit.label, hit.value)
    }
  }
  const attrs = readAttributes(p)
  connectorsOf(attrs).forEach((c) => add("connector", c))
  attrs.platform.forEach((pl) => add("platform", platformLabel(pl), pl))

  const colourIds = (p.options ?? []).filter((o) => COLOUR.test(o.title ?? "")).map((o) => o.id)
  for (const v of p.variants ?? []) {
    for (const o of v.options ?? []) {
      if (o.option_id && colourIds.includes(o.option_id) && o.value) add("colour", o.value)
    }
  }
  const range = priceRange(p)
  if (range) {
    // A product is in every band its variants' prices fall in
    for (const b of PRICE_BANDS) {
      if (range.max >= b.min && range.min < b.max) add("price", b.label, b.value)
    }
  }
  return out
}

/** A product matches when, for every facet with a selection, it has at least one chosen value */
export function matches(f: FacetValues, selection: Selection, except?: FacetKey): boolean {
  return FACET_KEYS.every((key) => {
    if (key === except) return true
    const chosen = selection[key]
    if (!chosen?.length) return true
    const has = f[key] ?? []
    return chosen.some((v) => has.includes(v))
  })
}

export const countMatches = (index: FacetIndexItem[], selection: Selection) =>
  index.reduce((n, item) => n + (matches(item.f, selection) ? 1 : 0), 0)

export type FacetOption = { value: string; label: string; count: number; selected: boolean }
export type Facet = { key: FacetKey; label: string; options: FacetOption[] }

const PRICE_ORDER: string[] = PRICE_BANDS.map((b) => b.value)

/**
 * Facets with disjunctive counts: an option's count is how many results the
 * listing would have if it were ticked too (OR within a facet, AND across
 * facets). A facet is shown only when it can narrow the list (two or more
 * options), or when something in it is ticked, so it can be unticked.
 * Selected values that match nothing are kept, with a count of 0.
 */
export function buildFacets(
  index: FacetIndexItem[],
  selection: Selection,
  labels: Labels,
  order: Partial<Record<FacetKey, string[]>> = {}
): Facet[] {
  const facets: Facet[] = []
  for (const key of FACET_KEYS) {
    const counts = new Map<string, number>()
    for (const item of index) {
      for (const v of item.f[key] ?? []) counts.set(v, counts.get(v) ?? 0)
      if (!matches(item.f, selection, key)) continue
      for (const v of item.f[key] ?? []) counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    const chosen = selection[key] ?? []
    for (const v of chosen) if (!counts.has(v)) counts.set(v, 0)
    if (counts.size < 2 && !chosen.length) continue

    const fixed = key === "price" ? PRICE_ORDER : order[key]
    const options = Array.from(counts.entries())
      .map(([value, count]) => ({
        value,
        count,
        label: labels[labelKey(key, value)] ?? value,
        selected: chosen.includes(value),
      }))
      .sort((a, b) =>
        fixed
          ? rank(fixed, a.value) - rank(fixed, b.value)
          : b.count - a.count || a.label.localeCompare(b.label)
      )
    facets.push({ key, label: FACET_LABELS[key], options })
  }
  return facets
}

const rank = (order: string[], v: string) => {
  const i = order.indexOf(v)
  return i === -1 ? order.length : i
}

export type Chip = { key: FacetKey; value: string; label: string }

/** Active filter chips, in facet order: "Connector: USB-C" */
export function activeChips(selection: Selection, labels: Labels): Chip[] {
  return FACET_KEYS.flatMap((key) =>
    (selection[key] ?? []).map((value) => ({
      key,
      value,
      label: `${FACET_LABELS[key]}: ${labels[labelKey(key, value)] ?? value}`,
    }))
  )
}

const time = (d: ListingProduct["created_at"]) => (d ? new Date(d).getTime() || 0 : 0)

/**
 * Sorts a filtered list. "featured" and "relevance" keep the incoming order
 * (backend order / search ranking) but move items that can't be bought to
 * the end; price sorts use the cheapest variant, unpriced items last.
 */
export function sortProducts<T extends ListingProduct>(products: T[], sort: ListingSort): T[] {
  const indexed = products.map((p, i) => ({
    p,
    i,
    buyable: (p.variants ?? []).some(isPurchasable),
    price: priceRange(p)?.min ?? null,
  }))
  const priceCmp = (dir: 1 | -1) => (a: (typeof indexed)[0], b: (typeof indexed)[0]) => {
    if (a.price === null || b.price === null) return a.price === null ? 1 : -1
    return (a.price - b.price) * dir
  }
  indexed.sort((a, b) => {
    switch (sort) {
      case "price-asc":
        return priceCmp(1)(a, b) || a.i - b.i
      case "price-desc":
        return priceCmp(-1)(a, b) || a.i - b.i
      case "newest":
        return time(b.p.created_at) - time(a.p.created_at) || a.i - b.i
      default:
        return Number(b.buyable) - Number(a.buyable) || a.i - b.i
    }
  })
  return indexed.map((x) => x.p)
}
