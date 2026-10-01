import type { HttpTypes } from "@medusajs/types"
import type { Crumb } from "@/lib/catalogue/json-ld"
import type { Listing } from "@/lib/catalogue/listing"
import {
  activeFilterCount,
  type ListingSort,
  type ListingState,
} from "@/lib/catalogue/listing-params"
import { JsonLd } from "@/lib/seo/json-ld"
import Breadcrumbs from "../components/breadcrumbs"
import FilterPanel from "../components/filter-panel"
import FilterSheet from "../components/filter-sheet"
import { ActiveChips, EmptyState, FitBanner, LoadMore } from "../components/listing-parts"
import ProductGrid from "../components/product-grid"
import SortSelect from "../components/sort-select"

type Props = {
  title: string
  /** lower-case plural for the empty state: "cases", "results" */
  what: string
  intro?: React.ReactNode
  crumbs: Crumb[]
  breadcrumbLd?: Record<string, unknown>
  listing: Listing<HttpTypes.StoreProduct>
  state: ListingState
  pathname: string
  defaultSort: ListingSort
  sortOptions: ListingSort[]
  deviceLabel: string | null
  pickerHref: string
  /** shown instead of the grid when there is nothing at all (search with no hits) */
  noResults?: React.ReactNode
}

/**
 * Shared listing layout for categories and search (docs/specs/design.md 7.2).
 * 375: breadcrumbs, H1 + count, fit banner, sticky toolbar [Filters][Sort],
 * chips, 2-col grid, Load more. 1280: 264px left rail + toolbar + 4-col grid.
 */
export default function ListingTemplate({
  title,
  what,
  intro,
  crumbs,
  breadcrumbLd,
  listing,
  state,
  pathname,
  defaultSort,
  sortOptions,
  deviceLabel,
  pickerHref,
  noResults,
}: Props) {
  const nav = { state, pathname, defaultSort }
  const fitToggle =
    listing.fit.kind === "filtered" || listing.fit.kind === "all"
      ? { device: listing.fit.device }
      : null
  const hasFilters = activeFilterCount(state.filters) > 0
  const showRail = listing.facets.length > 0 || !!fitToggle

  return (
    <div className="content-container pb-12">
      {breadcrumbLd && <JsonLd data={breadcrumbLd} />}
      <Breadcrumbs crumbs={crumbs} />
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] lg:text-4xl">
          {title}
        </h1>
        <p className="text-muted-foreground" aria-live="polite">
          {listing.total} {listing.total === 1 ? "item" : "items"}
        </p>
      </div>
      {intro}
      <FitBanner fit={listing.fit} pickerHref={pickerHref} {...nav} />

      <div className={showRail ? "mt-4 lg:mt-8 lg:grid lg:grid-cols-[264px_1fr] lg:gap-8" : "mt-4"}>
        {showRail && (
          <aside aria-label="Filters" className="hidden lg:block">
            <FilterPanel
              facets={listing.facets}
              state={state}
              pathname={pathname}
              defaultSort={defaultSort}
              fit={fitToggle}
              idPrefix="rail"
            />
          </aside>
        )}

        <div className="min-w-0">
          <div
            data-sticky-toolbar
            className="sticky top-[var(--header-stack)] z-30 -mx-4 flex min-h-[52px] items-center justify-between gap-3 border-b border-border bg-background px-4 py-1 lg:static lg:mx-0 lg:justify-end lg:border-0 lg:px-0"
          >
            <FilterSheet
              facets={listing.facets}
              index={listing.index}
              state={state}
              pathname={pathname}
              defaultSort={defaultSort}
              fit={fitToggle}
            />
            <SortSelect
              state={state}
              pathname={pathname}
              options={sortOptions}
              defaultSort={defaultSort}
            />
          </div>
          <ActiveChips chips={listing.chips} {...nav} />

          {listing.items.length ? (
            <div className="mt-6">
              <h2 className="sr-only">Products</h2>
              <ProductGrid
                products={listing.items}
                fitIds={listing.fitIds}
                deviceLabel={deviceLabel}
                columns={showRail ? "lg:grid-cols-3 xl:grid-cols-4" : "lg:grid-cols-4"}
                anchorFrom={1}
              />
              <LoadMore
                shown={listing.items.length}
                total={listing.total}
                hasMore={listing.hasMore}
                {...nav}
              />
            </div>
          ) : (
            (noResults ?? (
              <EmptyState
                what={what}
                device={listing.fit.kind === "filtered" ? listing.fit.device : null}
                hasFilters={hasFilters}
                {...nav}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
