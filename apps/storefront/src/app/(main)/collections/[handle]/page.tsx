import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { listCollectionProducts, listDeviceProductIds } from "@lib/data/catalogue"
import { getCollectionByHandle } from "@lib/data/collections"
import { getCurrentDevice } from "@lib/data/devices"
import { getBaseURL } from "@lib/util/env"
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
  params: Promise<{ handle: string }>
  searchParams: Promise<RawSearchParams>
}

/**
 * An admin-curated collection (e.g. "Best sellers", linked from the home
 * page), shown with the same listing as a category. Rendered on demand: it
 * reads the device cookie, and a build has no backend to list collections from.
 */
async function load(handle: string) {
  const collection = await getCollectionByHandle(handle)
  if (!collection) notFound()
  return collection
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const [{ handle }, sp] = await Promise.all([props.params, props.searchParams])
  const collection = await load(handle)
  const state = parseListingParams(sp)
  const canonical = `/collections/${collection.handle}`
  // Filtered and sorted variants are not separate pages for search engines
  const refined = activeFilterCount(state.filters) > 0 || state.sort !== "featured" || state.showAll
  return {
    title: collection.title,
    description: `${collection.title} from Tech Nest, Southwark Park Road, London SE16. Free Click & Collect, and delivery across the UK.`,
    alternates: { canonical: state.page > 1 && !refined ? `${canonical}?page=${state.page}` : canonical },
    robots: refined ? { index: false, follow: true } : undefined,
  }
}

export default async function CollectionPage(props: Props) {
  const [{ handle }, sp] = await Promise.all([props.params, props.searchParams])
  const collection = await load(handle)
  const state = parseListingParams(sp)

  const device = await getCurrentDevice().catch(() => null)
  const [{ products }, deviceIds] = await Promise.all([
    listCollectionProducts(collection.id),
    device ? listDeviceProductIds(device.slug) : Promise.resolve(null),
  ])
  const listing = buildListing(products, state, {
    device: device ? { label: device.model, productIds: deviceIds } : null,
  })

  const pathname = `/collections/${collection.handle}`
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: collection.title, path: pathname },
  ]

  return (
    <ListingTemplate
      title={collection.title}
      what="products"
      crumbs={crumbs}
      breadcrumbLd={breadcrumbJsonLd(getBaseURL(), crumbs)}
      listing={listing}
      state={state}
      pathname={pathname}
      defaultSort="featured"
      sortOptions={[...SORTS]}
      deviceLabel={device?.model ?? null}
      pickerHref={pickerHref(pathname, listingQuery(state))}
    />
  )
}
