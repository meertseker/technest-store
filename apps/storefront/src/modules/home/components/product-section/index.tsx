import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { HttpTypes } from "@medusajs/types"
import ProductCard from "../product-card"

type Props = {
  id: string
  title: string
  seeAllHref: string
  seeAllLabel: string
  products: HttpTypes.StoreProduct[]
  /** Rendered between the heading row and the grid (the deals tabs) */
  children?: React.ReactNode
  empty?: string
}

export const sectionTitle = "text-[22px] font-semibold leading-tight lg:text-[28px]"

/** H2 + "See all" + a 2-col (4-col from lg) grid of 4 products */
export default function ProductSection({
  id,
  title,
  seeAllHref,
  seeAllLabel,
  products,
  children,
  empty = "Nothing to show here right now.",
}: Props) {
  return (
    <section aria-labelledby={id} className="content-container py-12 lg:py-20">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h2 id={id} className={sectionTitle}>
          {title}
        </h2>
        <Link
          href={seeAllHref}
          className="inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-4"
        >
          {seeAllLabel}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      {children}
      {products.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-x-6">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded bg-surface p-4">{empty}</p>
      )}
    </section>
  )
}
