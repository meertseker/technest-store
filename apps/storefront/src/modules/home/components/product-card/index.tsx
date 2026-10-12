import Image from "next/image"
import Link from "next/link"
import { CircleCheck } from "lucide-react"
import type { HttpTypes } from "@medusajs/types"
import PhotoPlaceholder from "@/components/ui/photo-placeholder"
import { iconKeyFor } from "@/lib/catalogue/category-icon"
import { formatGbp, isOnePoundItem, minPrice } from "@/lib/home/select"
import { priceClass } from "@/lib/typography"

type Props = {
  product: HttpTypes.StoreProduct
  /** "iPhone 16" when this product is matched to the shopper's device */
  fitsDevice?: string | null
  /** true for the first row of a listing (above the fold on mobile) */
  eager?: boolean
}

/**
 * Product card (docs/specs/design.md 4): 1:1 photo on a bordered surface tile,
 * title (2 lines max), price in the display face, fit badge when a device is
 * set. The whole card is the link (an Add button, where there is one, sits
 * outside it). Prices are Medusa's major units, shown as they are.
 */
export default function ProductCard({ product, fitsDevice, eager }: Props) {
  const price = minPrice(product)
  const multiple =
    new Set(product.variants?.map((v) => v.calculated_price?.calculated_amount)).size > 1
  const addOn = isOnePoundItem(product)

  return (
    <Link
      href={`/p/${product.handle}`}
      className="group flex h-full flex-col rounded-lg focus-visible:outline-offset-4"
    >
      <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface transition-colors duration-150 group-hover:border-border-strong group-hover:bg-surface-2">
        {product.thumbnail ? (
          <Image
            src={product.thumbnail}
            alt=""
            fill
            loading={eager ? "eager" : "lazy"}
            sizes="(min-width: 1280px) 220px, (min-width: 1024px) 30vw, 45vw"
            className="object-contain p-5 transition-transform duration-200 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <PhotoPlaceholder
              icon={iconKeyFor(product.title, ...(product.categories ?? []).map((c) => c.handle))}
            />
          </div>
        )}
        {addOn && (
          <span
            className="absolute left-2 top-2 rounded-full bg-brand px-2.5 py-0.5 text-sm font-semibold text-brand-foreground"
            data-small-text
          >
            £1 add-on
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <h3 className="line-clamp-2 leading-snug group-hover:underline group-hover:underline-offset-4">
          {product.title}
        </h3>
        {price !== null && (
          <p className={`${priceClass} text-lg`}>
            {multiple && <span className="font-sans text-base font-normal text-muted-foreground">from </span>}
            {formatGbp(price)}
          </p>
        )}
        {fitsDevice && (
          <p className="inline-flex items-center gap-1 text-sm font-semibold text-success" data-small-text>
            <CircleCheck aria-hidden className="size-4 shrink-0" />
            Fits your {fitsDevice}
          </p>
        )}
      </div>
    </Link>
  )
}
