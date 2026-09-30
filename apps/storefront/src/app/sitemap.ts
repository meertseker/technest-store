import type { MetadataRoute } from "next"
import { sdk } from "@lib/config"
import { getBaseURL } from "@lib/util/env"
import { buildSitemap, type SitemapEntity } from "@/lib/seo/sitemap"

// Rendered per request: the shared SDK wrapper reads the locale cookie, so a
// static build would throw a dynamic-usage error inside listAll's catch and
// ship an empty sitemap. Crawlers fetch it rarely, so this is cheap.
export const dynamic = "force-dynamic"

const PAGE = 100
const MAX_PAGES = 50 // 5,000 per type, well under the 50,000-URL sitemap limit

type Page = { count?: number } & Record<string, unknown>
type Lister = (query: { fields: string; limit: number; offset: number }) => Promise<Page>

/** Every handle of a store list method, following offset pagination */
async function listAll(list: Lister, key: string): Promise<SitemapEntity[]> {
  const all: SitemapEntity[] = []
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await list({ fields: "handle,updated_at", limit: PAGE, offset: page * PAGE })
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
    listAll((q) => sdk.store.product.list(q), "products"),
    listAll((q) => sdk.store.category.list(q), "product_categories"),
    listAll((q) => sdk.store.collection.list(q), "collections"),
  ])
  return buildSitemap(getBaseURL(), { products, categories, collections })
}
