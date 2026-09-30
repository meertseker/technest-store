import type { MetadataRoute } from "next"
import { sdk } from "@lib/config"
import { getBaseURL } from "@lib/util/env"
import { buildSitemap, type SitemapEntity } from "@/lib/seo/sitemap"

// Rebuilt at most once an hour; new products appear within the hour
export const revalidate = 3600

const PAGE = 100
const MAX_PAGES = 50 // 5,000 per type, well under the 50,000-URL sitemap limit

/** Every handle of a store list route, following offset pagination */
async function listAll(path: string, key: string): Promise<SitemapEntity[]> {
  const all: SitemapEntity[] = []
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await sdk.client.fetch<Record<string, unknown>>(path, {
        query: { fields: "handle,updated_at", limit: PAGE, offset: page * PAGE },
        next: { revalidate },
      })
      const items = (body[key] as SitemapEntity[] | undefined) ?? []
      all.push(...items)
      if (items.length < PAGE || all.length >= Number(body.count ?? 0)) break
    }
  } catch {
    // Backend down (e.g. an offline build): keep what we have
  }
  return all
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, collections] = await Promise.all([
    listAll("/store/products", "products"),
    listAll("/store/product-categories", "product_categories"),
    listAll("/store/collections", "collections"),
  ])
  return buildSitemap(getBaseURL(), { products, categories, collections })
}
