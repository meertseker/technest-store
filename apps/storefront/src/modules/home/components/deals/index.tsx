import Link from "next/link"
import type { HttpTypes } from "@medusajs/types"
import { cn } from "@/lib/utils"
import type { DealsTab } from "@/lib/home/select"
import ProductSection from "../product-section"

type Props = {
  tab: DealsTab
  onePound: HttpTypes.StoreProduct[]
  underFive: HttpTypes.StoreProduct[]
  onePoundHref: string
}

const TABS: { id: DealsTab; label: string; href: string }[] = [
  { id: "one-pound", label: "£1", href: "/?deals=one-pound#deals" },
  { id: "under-5", label: "Under £5", href: "/?deals=under-5#deals" },
]

/**
 * £1 Deals / Under £5. The two "tabs" are plain links (?deals=...), rendered
 * on the server: no client JavaScript, they work without it, the choice can be
 * shared as a URL, and screen readers hear them as a small nav with the
 * current one marked (aria-current), which is honest about what they are.
 */
export default function Deals({ tab, onePound, underFive, onePoundHref }: Props) {
  const isOne = tab === "one-pound"
  return (
    <div id="deals" className="scroll-mt-24">
      <ProductSection
        id="deals-heading"
        title="£1 Deals and under £5"
        seeAllHref={isOne ? onePoundHref : "/store?sortBy=price_asc"}
        seeAllLabel={isOne ? "See all £1 deals" : "See all by lowest price"}
        products={isOne ? onePound : underFive}
        empty={isOne ? "No £1 deals right now." : "Nothing under £5 right now."}
      >
        <nav aria-label="Deals" className="mt-4">
          <ul className="flex gap-2">
            {TABS.map((t) => {
              const active = t.id === tab
              return (
                <li key={t.id}>
                  <Link
                    href={t.href}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full border px-5 font-semibold transition-colors duration-150",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border-strong bg-background hover:bg-surface"
                    )}
                  >
                    {t.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </ProductSection>
    </div>
  )
}
