/**
 * Listing URL state (docs/specs/design.md 7.2): filters, sort, page and the
 * "fits your device" toggle all live in the query string, so reload, back and
 * shared links keep them. Pure: used by the server pages and the client
 * filter panel alike.
 */

export const PAGE_SIZE = 24
/** A listing never renders more than this many pages at once (Load more is cumulative) */
export const MAX_PAGE = 50

export const FACET_KEYS = ["category", "connector", "platform", "colour", "price"] as const
export type FacetKey = (typeof FACET_KEYS)[number]

export const FACET_LABELS: Record<FacetKey, string> = {
  category: "Type",
  connector: "Connector",
  platform: "Works with",
  colour: "Colour",
  price: "Price",
}

export const SORTS = ["featured", "price-asc", "price-desc", "newest"] as const
export type SortKey = (typeof SORTS)[number]
/** Search results default to relevance: the search API's own order */
export type ListingSort = SortKey | "relevance"

export const SORT_LABELS: Record<ListingSort, string> = {
  relevance: "Best match",
  featured: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  newest: "Newest",
}

export type Selection = Partial<Record<FacetKey, string[]>>

export type ListingState = {
  filters: Selection
  sort: ListingSort
  page: number
  /** true when the shopper chose "Show all" instead of only items that fit their device */
  showAll: boolean
  /** search query (search page only) */
  q: string
}

export type RawSearchParams = Record<string, string | string[] | undefined>

const VALUE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_VALUES = 20

const list = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v]

/** "USB-C" -> "usb-c", "3.5mm" -> "3-5mm", "Chargers & Cables" -> "chargers-cables" */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

/**
 * Parses Next.js searchParams. Unknown keys are ignored, values that aren't
 * slugs are dropped (they can only come from a hand-edited URL), and each
 * facet also accepts comma-separated values.
 */
export function parseListingParams(
  sp: RawSearchParams,
  defaultSort: ListingSort = "featured"
): ListingState {
  const filters: Selection = {}
  for (const key of FACET_KEYS) {
    const values = list(sp[key])
      .flatMap((v) => v.split(","))
      .map((v) => v.trim().toLowerCase())
      .filter((v) => VALUE.test(v))
    const unique = Array.from(new Set(values)).slice(0, MAX_VALUES)
    if (unique.length) filters[key] = unique
  }
  const rawSort = list(sp.sort)[0]
  const sort: ListingSort =
    rawSort && (SORTS as readonly string[]).includes(rawSort)
      ? (rawSort as SortKey)
      : rawSort === "relevance" && defaultSort === "relevance"
        ? "relevance"
        : defaultSort
  const pageNum = parseInt(list(sp.page)[0] ?? "1", 10)
  const page = Number.isFinite(pageNum) ? Math.min(Math.max(pageNum, 1), MAX_PAGE) : 1
  const showAll = list(sp.fit)[0] === "all"
  const q = (list(sp.q)[0] ?? "").trim().slice(0, 100)
  return { filters, sort, page, showAll, q }
}

export const activeFilterCount = (filters: Selection) =>
  FACET_KEYS.reduce((n, k) => n + (filters[k]?.length ?? 0), 0)

type HrefOptions = { defaultSort?: ListingSort }

/**
 * The query string for a listing state. Defaults are left out (no
 * "?page=1&sort=featured") so every state has exactly one URL.
 */
export function listingQuery(state: ListingState, { defaultSort = "featured" }: HrefOptions = {}) {
  const params = new URLSearchParams()
  if (state.q) params.set("q", state.q)
  for (const key of FACET_KEYS) {
    for (const v of state.filters[key] ?? []) params.append(key, v)
  }
  if (state.sort !== defaultSort) params.set("sort", state.sort)
  if (state.showAll) params.set("fit", "all")
  if (state.page > 1) params.set("page", String(state.page))
  return params.toString()
}

export function listingHref(pathname: string, state: ListingState, options?: HrefOptions) {
  const qs = listingQuery(state, options)
  return qs ? `${pathname}?${qs}` : pathname
}

/** Adds or removes one filter value; any change of filters goes back to page 1 */
export function toggleValue(state: ListingState, key: FacetKey, value: string): ListingState {
  const current = state.filters[key] ?? []
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  const filters: Selection = { ...state.filters }
  if (next.length) filters[key] = next
  else delete filters[key]
  return { ...state, filters, page: 1 }
}

export const clearFilters = (state: ListingState): ListingState => ({
  ...state,
  filters: {},
  page: 1,
})

export const withSort = (state: ListingState, sort: ListingSort): ListingState => ({
  ...state,
  sort,
  page: 1,
})

export const withPage = (state: ListingState, page: number): ListingState => ({
  ...state,
  page: Math.min(Math.max(page, 1), MAX_PAGE),
})

export const withShowAll = (state: ListingState, showAll: boolean): ListingState => ({
  ...state,
  showAll,
  page: 1,
})
