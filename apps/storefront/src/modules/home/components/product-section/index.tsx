import Link from "next/link"
import type { HttpTypes } from "@medusajs/types"
import { blockLinkClass, h2Class } from "@/lib/typography"
import ProductCard from "../product-card"

type Props = {
  id: string
  title: string
  /** one short line under the title */
  lede?: string
  seeAllHref: string
  seeAllLabel: string
  products: HttpTypes.StoreProduct[]
  /** Rendered between the heading row and the grid (the deals tabs) */
  children?: React.ReactNode
  empty?: string
}

/** @deprecated use h2Class from lib/typography */
export const sectionTitle = h2Class

/** H2 (+ lede) with "See all" on the right, then a 2-col (4-col from lg) grid of 4 products */
export default function ProductSection({
  id,
  title,
  lede,
  seeAllHref,
  seeAllLabel,
  products,
  children,
  empty = "Nothing to show here right now.",
}: Props) {
  return (
    <section aria-labelledby={id} className="content-container section">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 id={id} className={h2Class}>
            {title}
          </h2>
          {lede && <p className="mt-1 max-w-[60ch] text-muted-foreground">{lede}</p>}
        </div>
        <Link href={seeAllHref} className={blockLinkClass}>
          {seeAllLabel}
        </Link>
      </div>
      {children}
      {products.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:gap-x-6">
          {products.map((p, i) => (
            <li key={p.id}>
              <ProductCard product={p} eager={i < 2} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-lg bg-surface p-4">{empty}</p>
      )}
    </section>
  )
}
