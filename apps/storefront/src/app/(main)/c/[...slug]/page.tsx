import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCurrentDevice } from "@lib/data/devices"
import {
  listAllCategories,
  listCategoryProducts,
  listDeviceProductIds,
} from "@lib/data/catalogue"
import { getBaseURL } from "@lib/util/env"
import {
  ancestry,
  childrenOf,
  descendantIds,
  resolveCategory,
  subcategoryFacet,
} from "@/lib/catalogue/categories"
import { breadcrumbJsonLd, type Crumb } from "@/lib/catalogue/json-ld"
import { buildListing } from "@/lib/catalogue/listing"
import {
  activeFilterCount,
  listingQuery,
  parseListingParams,
  SORTS,
  type RawSearchParams,
} from "@/lib/catalogue/listing-params"
import { pickerHref } from "@/lib/devices/cookie"
import ListingTemplate from "@modules/catalogue/templates/listing"

type Props = {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<RawSearchParams>
}

async function load(slug: string[]) {
  const categories = await listAllCategories()
  const resolved = resolveCategory(categories, slug)
  if (!resolved) notFound()
  return { categories, ...resolved }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([props.params, props.searchParams])
  const { category, canonical } = await load(slug)
  const state = parseListingParams(sp)
  // Filtered and sorted variants are not separate pages for search engines
  const refined = activeFilterCount(state.filters) > 0 || state.sort !== "featured" || state.showAll
  return {
    title: category.name,
    description:
      category.description ||
      `${category.name} from Tech Nest, Southwark Park Road, London SE16. Free Click & Collect, and delivery across the UK.`,
    alternates: { canonical: state.page > 1 && !refined ? `${canonical}?page=${state.page}` : canonical },
    robots: refined ? { index: false, follow: true } : undefined,
  }
}

export default async function CategoryPage(props: Props) {
  const [{ slug }, sp] = await Promise.all([props.params, props.searchParams])
  const { categories, category, canonical } = await load(slug)
  const state = parseListingParams(sp)

  const device = await getCurrentDevice().catch(() => null)
  const [{ products }, deviceIds] = await Promise.all([
    listCategoryProducts(descendantIds(categories, category.id)),
    device ? listDeviceProductIds(device.slug) : Promise.resolve(null),
  ])

  const listing = buildListing(products, state, {
    device: device ? { label: device.model, productIds: deviceIds } : null,
    categoryFacet: subcategoryFacet(categories, category.id),
    facetOrder: { category: childrenOf(categories, category.id).map((c) => c.handle) },
  })

  const chain = ancestry(categories, category)
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    ...chain.map((c, i) => ({
      name: c.name,
      path: `/c/${chain
        .slice(0, i + 1)
        .map((x) => x.handle)
        .join("/")}`,
    })),
  ]
  const pathname = `/c/${slug.join("/")}`
  const qs = listingQuery(state)

  return (
    <ListingTemplate
      title={category.name}
      what={category.name.toLowerCase()}
      intro={
        category.description ? (
          <p className="mt-2 max-w-[68ch] text-muted-foreground">{category.description}</p>
        ) : null
      }
      crumbs={crumbs}
      breadcrumbLd={breadcrumbJsonLd(getBaseURL(), crumbs)}
      listing={listing}
      state={state}
      pathname={canonical}
      defaultSort="featured"
      sortOptions={[...SORTS]}
      deviceLabel={device?.model ?? null}
      pickerHref={pickerHref(pathname, qs)}
    />
  )
}
