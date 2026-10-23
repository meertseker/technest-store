import { Metadata } from "next"
import type { HttpTypes } from "@medusajs/types"
import { STORE_COUNTRY } from "@lib/constants/store"
import { listCategories } from "@lib/data/categories"
import { getCollectionByHandle } from "@lib/data/collections"
import { getCurrentDevice, listDevices } from "@lib/data/devices"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { pickCategoryTiles, pickNewIn } from "@/lib/home/select"
import { categoryPath } from "@/lib/catalogue/categories"
import CategoryTiles from "@modules/home/components/category-tiles"
import GoogleReviews from "@modules/home/components/google-reviews"
import Hero from "@modules/home/components/hero"
import ProductSection from "@modules/home/components/product-section"
import { RepairsCta, ShopStrip, TradeBanner } from "@modules/home/components/promo-bands"
import TrustRow from "@modules/home/components/trust-row"

export const metadata: Metadata = {
  description:
    "Cases, screen protectors, chargers, audio and gaming accessories that fit your device. Free Click & Collect from our shop on Southwark Park Road, London SE16, and phone and console repairs.",
  alternates: { canonical: "/" },
}

/** Admin-curated best sellers, shown below the categories when the collection has products */
const BEST_SELLERS_COLLECTION = "best-sellers"

const PRODUCT_FIELDS =
  "id,title,handle,thumbnail,created_at,collection_id,+metadata,*categories,*variants.calculated_price"

type SP = Promise<Record<string, string | string[] | undefined>>

const orNull = <T,>(p: Promise<T>) => p.catch(() => null)

async function loadCatalogue(regionId: string) {
  const [products, categories, bestSellers] = await Promise.all([
    // The demo catalogue is small: one cached call covers every section. Once
    // it passes 100 products, deals/under-£5 need their own backend queries.
    orNull(
      listProducts({ regionId, queryParams: { limit: 100, fields: PRODUCT_FIELDS } }).then(
        (r) => r.response.products
      )
    ),
    orNull(
      listCategories({ fields: "id,name,handle,rank,parent_category_id,+metadata", limit: 100 })
    ),
    orNull(getCollectionByHandle(BEST_SELLERS_COLLECTION)),
  ])
  return { products, categories, bestSellers }
}

// The £1 range is gone (the shop stopped selling £1 items, 2026-10-24), and with it the deals section.
export default async function Home(_props: { searchParams?: SP }) {
  const [region, tree, current] = await Promise.all([
    orNull(getRegion(STORE_COUNTRY)),
    listDevices(),
    orNull(getCurrentDevice()),
  ])
  const { products, categories, bestSellers } = region
    ? await loadCatalogue(region.id)
    : { products: null, categories: null, bestSellers: null }

  const all: HttpTypes.StoreProduct[] = products ?? []
  const curated = bestSellers ? all.filter((p) => p.collection_id === bestSellers.id) : []
  const tiles = pickCategoryTiles(categories ?? [], 8)

  const now = new Date()

  return (
    <>
      <Hero
        tree={tree}
        current={current}
        categories={categories ?? []}
        hrefFor={(c) => categoryPath(categories ?? [], c)}
      />
      {/* New in comes straight after the hero (lead's request, 2026-10-24): fresh stock first. */}
      {products ? (
        <ProductSection
          id="new-in-heading"
          title="New in"
          lede="The latest additions to the shelves."
          seeAllHref="/search"
          seeAllLabel="See all products"
          products={pickNewIn(all)}
        />
      ) : null}
      <TrustRow />

      {products ? (
        <>
          <CategoryTiles
            categories={tiles}
            hrefFor={(c) => categoryPath(categories ?? [], c)}
          />
          {curated.length ? (
            <ProductSection
              id="best-sellers-heading"
              title="Best sellers"
              lede="What customers buy most, chosen by the shop."
              seeAllHref={`/collections/${BEST_SELLERS_COLLECTION}`}
              seeAllLabel="See all best sellers"
              products={curated.slice(0, 4)}
            />
          ) : null}
        </>
      ) : (
        <p className="content-container section text-center text-muted-foreground">
          We can&apos;t show products right now. Please try again in a moment.
        </p>
      )}

      <RepairsCta />
      <GoogleReviews />
      <ShopStrip now={now} />
      <TradeBanner />
    </>
  )
}
