import type { HttpTypes } from "@medusajs/types"
import { isPurchasable } from "@/lib/catalogue/variants"
import ProductCard from "@modules/home/components/product-card"
import QuickAdd from "./quick-add"

type Props = {
  products: HttpTypes.StoreProduct[]
  /** ids of products that fit the shopper's device */
  fitIds?: string[]
  deviceLabel?: string | null
  /** e.g. "lg:grid-cols-3 xl:grid-cols-4" next to a filter rail */
  columns?: string
  /** anchor ids ("item-25") so Load more can land on the first new product */
  anchorFrom?: number
}

/** 2 columns on mobile (gap 12px), more from lg; 24 per page upstream */
export default function ProductGrid({
  products,
  fitIds = [],
  deviceLabel,
  columns = "lg:grid-cols-4",
  anchorFrom,
}: Props) {
  const fits = new Set(fitIds)
  return (
    <ul className={`grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:gap-x-6 ${columns}`}>
      {products.map((p, i) => {
        const variants = p.variants ?? []
        const single = variants.length === 1 && isPurchasable(variants[0]) ? variants[0] : null
        return (
          <li
            key={p.id}
            id={anchorFrom !== undefined ? `item-${i + 1}` : undefined}
            className="flex scroll-mt-40 flex-col"
          >
            <div className="flex-1">
              <ProductCard
                product={p}
                eager={i < 2}
                fitsDevice={deviceLabel && fits.has(p.id) ? deviceLabel : null}
              />
            </div>
            {single && <QuickAdd variantId={single.id} title={p.title} />}
          </li>
        )
      })}
    </ul>
  )
}
