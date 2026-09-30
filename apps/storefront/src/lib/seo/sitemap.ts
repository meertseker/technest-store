import type { MetadataRoute } from "next"
import { LEGAL_DRAFT } from "@/lib/legal/business"
import { LEGAL_PAGES } from "@/lib/legal/pages"

export type SitemapEntity = { handle: string; updated_at?: string | Date | null }

export type SitemapData = {
  products: SitemapEntity[]
  categories: SitemapEntity[]
  collections: SitemapEntity[]
}

/**
 * Public, indexable pages that exist today (E3 [CONTRACT] 2026-09-30).
 * Add /repairs, /trade, /devices/... and the /p, /c canonical paths here
 * when those routes ship. /welcome (till poster) is noindex on purpose.
 */
export const STATIC_PATHS = ["/", "/store", "/about", "/contact"] as const

/** Paths search engines must not crawl: basket, checkout, accounts, orders, APIs */
export const PRIVATE_PATHS = [
  "/cart",
  "/basket",
  "/checkout",
  "/account",
  "/order",
  "/api/",
  "/welcome",
] as const

const lastModified = (d: SitemapEntity["updated_at"]) => (d ? new Date(d) : undefined)

const SAFE_HANDLE = /^[a-z0-9][a-z0-9\-_/]*$/i

/** Builds the sitemap from backend data. Pure, so it is unit-tested. */
export function buildSitemap(baseUrl: string, data: SitemapData): MetadataRoute.Sitemap {
  const base = baseUrl.replace(/\/+$/, "")
  const url = (path: string) => `${base}${path === "/" ? "" : path}`
  const entities = (prefix: string, list: SitemapEntity[], priority: number) =>
    list
      .filter((e) => typeof e.handle === "string" && SAFE_HANDLE.test(e.handle))
      .map((e) => ({
        url: url(`${prefix}/${e.handle.split("/").map(encodeURIComponent).join("/")}`),
        lastModified: lastModified(e.updated_at),
        priority,
      }))

  return [
    { url: url("/"), priority: 1 },
    ...STATIC_PATHS.filter((p) => p !== "/").map((p) => ({ url: url(p), priority: 0.5 })),
    // Legal drafts are noindex, so they stay out until the lead signs them off
    ...(LEGAL_DRAFT ? [] : LEGAL_PAGES.map((p) => ({ url: url(`/legal/${p.slug}`), priority: 0.2 }))),
    ...entities("/products", data.products, 0.8),
    ...entities("/categories", data.categories, 0.6),
    ...entities("/collections", data.collections, 0.6),
  ]
}
