import type { Metadata } from "next"
import Link from "next/link"
import { Search as SearchIcon } from "lucide-react"
import { getCurrentDevice } from "@lib/data/devices"
import {
  listAllCategories,
  listAllProducts,
  listDeviceProductIds,
  listProductsByIds,
  searchProductIds,
  type CatalogueProduct,
} from "@lib/data/catalogue"
import { categoryPath } from "@/lib/catalogue/categories"
import type { Crumb } from "@/lib/catalogue/json-ld"
import { buildListing } from "@/lib/catalogue/listing"
import {
  listingQuery,
  parseListingParams,
  SORTS,
  type ListingSort,
  type RawSearchParams,
} from "@/lib/catalogue/listing-params"
import { pickerHref } from "@/lib/devices/cookie"
import { Button } from "@/components/ui/button"
import ListingTemplate from "@modules/catalogue/templates/listing"

type Props = { searchParams: Promise<RawSearchParams> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { q } = parseListingParams(await props.searchParams)
  return {
    title: q ? `Search results for "${q}"` : "All products",
    // Result pages are thin duplicates of category pages: keep them out of the index
    robots: { index: false, follow: true },
  }
}

function SearchForm({ q }: { q: string }) {
  return (
    <form role="search" action="/search" method="get" className="mt-4 flex max-w-xl gap-2">
      <label htmlFor="search-page-q" className="sr-only">
        Search products
      </label>
      <input
        id="search-page-q"
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Search cases, chargers, cables…"
        autoComplete="off"
        enterKeyHint="search"
        className="min-h-12 w-full min-w-0 flex-1 rounded border border-border-strong bg-background px-3 text-base"
      />
      <Button type="submit" variant="secondary">
        <SearchIcon aria-hidden />
        Search
      </Button>
    </form>
  )
}

export default async function SearchPage(props: Props) {
  const sp = await props.searchParams
  const defaultSort: ListingSort = parseListingParams(sp).q ? "relevance" : "newest"
  const state = parseListingParams(sp, defaultSort)
  const { q } = state

  let products: CatalogueProduct[] = []
  let failed = false
  try {
    products = q
      ? await listProductsByIds(await searchProductIds(q))
      : (await listAllProducts()).products
  } catch {
    failed = true
  }

  const device = await getCurrentDevice().catch(() => null)
  const deviceIds = device ? await listDeviceProductIds(device.slug) : null
  const listing = buildListing(products, state, {
    device: device ? { label: device.model, productIds: deviceIds } : null,
  })

  const title = q ? `Results for “${q}”` : "All products"
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: q ? "Search" : "All products", path: "/search" },
  ]

  let noResults: React.ReactNode = undefined
  if (failed || (q && !products.length)) {
    const top = await listAllCategories()
      .then((all) => all.filter((c) => !c.parent_category_id).map((c) => ({ ...c, href: categoryPath(all, c) })))
      .catch(() => [])
    noResults = (
      <div className="mt-8 rounded bg-surface p-6">
        <h2 className="text-[22px] font-semibold leading-tight">
          {failed ? "Search isn't working right now" : `No results for “${q}”`}
        </h2>
        <p className="mt-2 max-w-prose">
          {failed
            ? "Please try again in a moment, or browse by category."
            : "Check the spelling, try a shorter word (for example “case” or “usb-c”), or browse by category."}
        </p>
        {top.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {top.map((c) => (
              <li key={c.id}>
                <Link
                  href={c.href}
                  className="inline-flex min-h-11 items-center rounded-full bg-background px-4 hover:underline"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <ListingTemplate
      title={title}
      what={q ? "results" : "products"}
      intro={<SearchForm q={q} />}
      crumbs={crumbs}
      listing={listing}
      state={state}
      pathname="/search"
      defaultSort={defaultSort}
      sortOptions={q ? ["relevance", ...SORTS] : [...SORTS]}
      deviceLabel={device?.model ?? null}
      pickerHref={pickerHref("/search", listingQuery(state, { defaultSort }))}
      noResults={noResults}
    />
  )
}
