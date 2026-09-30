import Image from "next/image"
import Link from "next/link"
import { Package } from "lucide-react"
import type { HttpTypes } from "@medusajs/types"
import { formatGbp, isOnePoundItem, minPrice } from "@/lib/home/select"

/**
 * Product card (docs/specs/design.md 4): 1:1 image on the surface tile, title
 * (2 lines max), price (18px, tabular). The whole card is the link. Prices are
 * Medusa's major units, shown as they are (never divided). Below the fold, so
 * the image is lazy.
 */
export default function ProductCard({ product }: { product: HttpTypes.StoreProduct }) {
  const price = minPrice(product)
  const multiple = new Set(product.variants?.map((v) => v.calculated_price?.calculated_amount)).size > 1
  const addOn = isOnePoundItem(product)

  return (
    <Link
      href={`/products/${product.handle}`}
      className="group flex h-full flex-col rounded focus-visible:outline-offset-4"
    >
      <div className="relative aspect-square overflow-hidden rounded bg-surface">
        {product.thumbnail ? (
          <Image
            src={product.thumbnail}
            alt=""
            fill
            loading="lazy"
            sizes="(min-width: 1024px) 280px, 45vw"
            className="object-contain p-4"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Package aria-hidden className="size-10" strokeWidth={1.5} />
          </div>
        )}
        {addOn && (
          <span className="absolute left-2 top-2 rounded-full bg-brand-subtle px-2 py-0.5 text-sm font-semibold text-brand">
            £1 add-on
          </span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 font-normal group-hover:underline group-hover:underline-offset-4">
        {product.title}
      </h3>
      {price !== null && (
        <p className="mt-1 text-lg font-bold tabular-nums">
          {multiple && <span className="text-base font-normal text-muted-foreground">from </span>}
          {formatGbp(price)}
        </p>
      )}
    </Link>
  )
}
