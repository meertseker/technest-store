/**
 * Structured data for the product page (docs/specs/design.md 7.3): Product
 * with an Offer (or AggregateOffer when variant prices differ) and a
 * BreadcrumbList. Prices are the region's tax-inclusive GBP amounts in major
 * units, exactly as Medusa returns them. No AggregateRating: Google shop
 * reviews must never be marked up as product ratings.
 */
import { isPurchasable, priceRange, type ProductLike } from "./variants"

export type Crumb = { name: string; path: string }

export function breadcrumbJsonLd(baseUrl: string, crumbs: Crumb[]) {
  const base = baseUrl.replace(/\/+$/, "")
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${base}${c.path === "/" ? "" : c.path}`,
    })),
  }
}

type JsonLdProduct = ProductLike & {
  title: string
  handle: string
  description?: string | null
  thumbnail?: string | null
  images?: { url: string }[] | null
  variants?: (NonNullable<ProductLike["variants"]>[number] & { sku?: string | null })[] | null
}

/** Schema.org wants a price as a string with at most 2 decimals: "9.99", "1.00" */
export const schemaPrice = (n: number) => n.toFixed(2)

export function productJsonLd(
  baseUrl: string,
  product: JsonLdProduct,
  opts: { brand?: string } = {}
): Record<string, unknown> {
  const base = baseUrl.replace(/\/+$/, "")
  const url = `${base}/p/${encodeURIComponent(product.handle)}`
  const images = [
    ...(product.images ?? []).map((i) => i.url),
    ...(product.thumbnail ? [product.thumbnail] : []),
  ].filter((u, i, all) => !!u && all.indexOf(u) === i)
  const range = priceRange(product)
  const variants = product.variants ?? []
  const availability = variants.some(isPurchasable)
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock"
  const skus = variants.map((v) => v.sku).filter((s): s is string => !!s)

  const offers = !range
    ? undefined
    : range.min === range.max
      ? {
          "@type": "Offer",
          url,
          priceCurrency: "GBP",
          price: schemaPrice(range.min),
          availability,
          itemCondition: "https://schema.org/NewCondition",
        }
      : {
          "@type": "AggregateOffer",
          url,
          priceCurrency: "GBP",
          lowPrice: schemaPrice(range.min),
          highPrice: schemaPrice(range.max),
          offerCount: variants.length,
          availability,
          itemCondition: "https://schema.org/NewCondition",
        }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    url,
    ...(product.description ? { description: product.description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(skus.length === 1 ? { sku: skus[0] } : {}),
    ...(opts.brand ? { brand: { "@type": "Brand", name: opts.brand } } : {}),
    ...(offers ? { offers } : {}),
  }
}
