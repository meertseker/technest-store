import "server-only"
import { cache } from "react"
import type { HttpTypes } from "@medusajs/types"
import { sdk } from "@lib/config"
import { STORE_COUNTRY } from "@lib/constants/store"
import { PRODUCT_INDEX_NAME, searchClient } from "@lib/search-client"
import type { CategoryNode } from "@/lib/catalogue/categories"
import type { Device } from "@/lib/devices/types"
import { getRegion } from "./regions"

/**
 * Catalogue reads for the listing, product, device and search pages. All go
 * through the Medusa JS SDK (publishable key header). Responses are cached
 * briefly; product data changes from the admin appear within a minute.
 */

export type CatalogueProduct = HttpTypes.StoreProduct & {
  product_attributes?: Record<string, unknown> | null
}

const REVALIDATE = 60
/** Hard cap on products loaded for one listing (the shop stocks a few hundred) */
const MAX_PRODUCTS = 1000
const PAGE = 100

/** Everything a card, a filter and the product page need */
const LIST_FIELDS = [
  "id",
  "title",
  "handle",
  "thumbnail",
  "created_at",
  "+metadata",
  "*categories",
  "*options",
  "*variants.options",
  "*variants.calculated_price",
  "+variants.inventory_quantity",
  "+variants.manage_inventory",
  "+variants.allow_backorder",
  "variants.sku",
  "variants.title",
].join(",")

const DETAIL_FIELDS = `${LIST_FIELDS},description,subtitle,*images,*tags,updated_at`
const ATTRIBUTES_FIELD = "+product_attributes.*"

/**
 * The product_attributes link (docs/contracts/product-attributes.md) exists
 * only on backends with E1's module. An older backend rejects the field, so
 * the first failure switches it off for this server process and the
 * attributes are read from metadata instead.
 */
let attributesSupported = true

type ProductsBody = { products: CatalogueProduct[]; count: number }

async function fetchProducts(
  path: string,
  query: Record<string, unknown>,
  tags: string[]
): Promise<ProductsBody> {
  const run = (withAttributes: boolean) =>
    sdk.client.fetch<ProductsBody>(path, {
      method: "GET",
      query: {
        ...query,
        fields: withAttributes ? `${query.fields},${ATTRIBUTES_FIELD}` : query.fields,
      },
      next: { revalidate: REVALIDATE, tags },
      cache: "force-cache",
    })
  if (!attributesSupported) return run(false)
  try {
    return await run(true)
  } catch (e) {
    const body = await run(false) // throws again if the backend itself is down
    attributesSupported = false
    void e
    return body
  }
}

/** Follows offset pagination up to MAX_PRODUCTS */
async function fetchAll(
  path: string,
  query: Record<string, unknown>,
  tags: string[]
): Promise<{ products: CatalogueProduct[]; count: number }> {
  const products: CatalogueProduct[] = []
  let count = 0
  for (let offset = 0; offset < MAX_PRODUCTS; offset += PAGE) {
    const body = await fetchProducts(path, { ...query, limit: PAGE, offset }, tags)
    products.push(...body.products)
    count = body.count
    if (body.products.length < PAGE || products.length >= count) break
  }
  return { products, count }
}

export const getStoreRegion = cache(async () => {
  const region = await getRegion(STORE_COUNTRY)
  if (!region) throw new Error("The UK region is missing")
  return region
})

export const listAllCategories = cache(async (): Promise<CategoryNode[]> => {
  const { product_categories } = await sdk.client.fetch<{
    product_categories: CategoryNode[]
  }>("/store/product-categories", {
    method: "GET",
    query: {
      fields: "id,name,handle,rank,parent_category_id,description",
      limit: 500,
    },
    next: { revalidate: 300, tags: ["categories"] },
    cache: "force-cache",
  })
  return product_categories
})

/** Every published product in these categories (children are not added automatically: pass them) */
export async function listCategoryProducts(categoryIds: string[]) {
  const region = await getStoreRegion()
  return fetchAll(
    "/store/products",
    { category_id: categoryIds, region_id: region.id, fields: LIST_FIELDS, order: "-created_at" },
    ["products"]
  )
}

export async function listAllProducts() {
  const region = await getStoreRegion()
  return fetchAll(
    "/store/products",
    { region_id: region.id, fields: LIST_FIELDS, order: "-created_at" },
    ["products"]
  )
}

/** Products by id, returned in the order of `ids` (search ranking) */
export async function listProductsByIds(ids: string[]): Promise<CatalogueProduct[]> {
  if (!ids.length) return []
  const region = await getStoreRegion()
  const out: CatalogueProduct[] = []
  for (let i = 0; i < ids.length; i += PAGE) {
    const chunk = ids.slice(i, i + PAGE)
    const body = await fetchProducts(
      "/store/products",
      { id: chunk, region_id: region.id, fields: LIST_FIELDS, limit: PAGE },
      ["products"]
    )
    out.push(...body.products)
  }
  const pos = new Map(ids.map((id, i) => [id, i]))
  return out.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
}

export async function getProductByHandle(handle: string): Promise<CatalogueProduct | null> {
  const region = await getStoreRegion()
  const body = await fetchProducts(
    "/store/products",
    { handle, region_id: region.id, fields: DETAIL_FIELDS, limit: 1 },
    ["products"]
  )
  return body.products[0] ?? null
}

// ---------------------------------------------------------------- devices

/** GET /store/devices/:slug; null when unknown */
export const getDevice = cache(
  async (slug: string): Promise<{ device: Device; product_count: number } | null> => {
    try {
      return await sdk.client.fetch<{ device: Device; product_count: number }>(
        `/store/devices/${encodeURIComponent(slug)}`,
        { method: "GET", next: { revalidate: 300, tags: ["devices"] }, cache: "force-cache" }
      )
    } catch {
      return null
    }
  }
)

/** Products that fit a device (GET /store/devices/:slug/products, same shape as /store/products) */
export async function listDeviceProducts(slug: string) {
  const region = await getStoreRegion()
  return fetchAll(
    `/store/devices/${encodeURIComponent(slug)}/products`,
    { region_id: region.id, fields: LIST_FIELDS, order: "-created_at" },
    ["products", "devices"]
  )
}

/**
 * Ids of the products that fit a device. Null when unknown (route missing or
 * backend error): callers must then not filter or claim anything.
 */
export const listDeviceProductIds = cache(async (slug: string): Promise<Set<string> | null> => {
  try {
    const ids = new Set<string>()
    for (let offset = 0; offset < MAX_PRODUCTS; offset += PAGE) {
      const body = await sdk.client.fetch<{ products: { id: string }[]; count: number }>(
        `/store/devices/${encodeURIComponent(slug)}/products`,
        {
          method: "GET",
          query: { fields: "id", limit: PAGE, offset },
          next: { revalidate: REVALIDATE, tags: ["products", "devices"] },
          cache: "force-cache",
        }
      )
      body.products.forEach((p) => ids.add(p.id))
      if (body.products.length < PAGE || ids.size >= body.count) break
    }
    return ids
  } catch {
    return null
  }
})

// ---------------------------------------------------------------- search

/** The search route accepts at most 100 hits per request */
const SEARCH_PAGE = 100

/**
 * Product ids for a query from the search index (POST /store/search through
 * the shared InstantSearch adapter), best match first, up to `limit`.
 */
export async function searchProductIds(q: string, limit = 300): Promise<string[]> {
  const ids: string[] = []
  for (let page = 0; ids.length < limit; page++) {
    const { results } = await searchClient.search([
      { indexName: PRODUCT_INDEX_NAME, params: { query: q, hitsPerPage: SEARCH_PAGE, page } },
    ])
    const hits = results[0]?.hits ?? []
    ids.push(...hits.map((h) => String(h.objectID)))
    if (hits.length < SEARCH_PAGE) break
  }
  return ids.slice(0, limit)
}
