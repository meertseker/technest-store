/**
 * Builds one listing page from all products in scope (pure: tested without a
 * server). Order of operations: device fit -> filters -> sort -> page slice.
 */
import {
  activeChips,
  buildFacets,
  facetValuesOf,
  matches,
  sortProducts,
  type CategoryFacet,
  type Chip,
  type Facet,
  type FacetIndexItem,
  type Labels,
  type ListingProduct,
} from "./facets"
import { PAGE_SIZE, type FacetKey, type ListingState } from "./listing-params"

export type FitMode =
  /** no device chosen, or the device's product list is unknown */
  | { kind: "none" }
  /** a device is chosen but nothing in scope is matched to devices (e.g. chargers): no filter */
  | { kind: "not-applicable"; device: string }
  /** filtered to items that fit; `total` is the unfiltered count */
  | { kind: "filtered"; device: string; total: number }
  /** the shopper chose "Show all"; `fitting` is how many fit */
  | { kind: "all"; device: string; fitting: number }

export type Listing<T> = {
  /** products on the page(s) shown: cumulative up to state.page (Load more) */
  items: T[]
  /** results after fit + filters */
  total: number
  facets: Facet[]
  chips: Chip[]
  /** compact per-product facet values for the filter sheet's live count */
  index: FacetIndexItem[]
  fit: FitMode
  /** ids of products that fit the device (for card badges), empty when unknown */
  fitIds: string[]
  hasMore: boolean
}

export function buildListing<T extends ListingProduct>(
  products: T[],
  state: ListingState,
  opts: {
    device?: { label: string; productIds: Set<string> | null } | null
    categoryFacet?: CategoryFacet | null
    facetOrder?: Partial<Record<FacetKey, string[]>>
  } = {}
): Listing<T> {
  const { device, categoryFacet = null, facetOrder } = opts

  let scope = products
  let fit: FitMode = { kind: "none" }
  const fitIds: string[] = []
  if (device?.productIds) {
    const fitting = products.filter((p) => device.productIds!.has(p.id))
    fitting.forEach((p) => fitIds.push(p.id))
    if (!fitting.length) fit = { kind: "not-applicable", device: device.label }
    else if (state.showAll) fit = { kind: "all", device: device.label, fitting: fitting.length }
    else {
      fit = { kind: "filtered", device: device.label, total: products.length }
      scope = fitting
    }
  }

  const labels: Labels = {}
  const withFacets = scope.map((p) => ({ p, f: facetValuesOf(p, categoryFacet, labels) }))
  const index: FacetIndexItem[] = withFacets.map(({ p, f }) => ({ id: p.id, f }))
  const filtered = withFacets.filter(({ f }) => matches(f, state.filters)).map((x) => x.p)
  const sorted = sortProducts(filtered, state.sort)
  const shown = state.page * PAGE_SIZE

  return {
    items: sorted.slice(0, shown),
    total: sorted.length,
    facets: buildFacets(index, state.filters, labels, facetOrder),
    chips: activeChips(state.filters, labels),
    index,
    fit,
    fitIds,
    hasMore: sorted.length > shown,
  }
}
