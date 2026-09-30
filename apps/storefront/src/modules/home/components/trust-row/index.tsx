import { RotateCcw, Star, Store } from "lucide-react"
import { siteConfig } from "@/lib/site-config"

/** Three facts under the hero; they wrap on narrow screens (never scroll sideways) */
export default function TrustRow() {
  const { value, count } = siteConfig.rating
  const items = [
    { icon: Store, label: "Free Click & Collect" },
    { icon: Star, label: `${value.toFixed(1)} on Google`, detail: `${count} reviews` },
    { icon: RotateCcw, label: "14-day returns" },
  ]
  return (
    <section aria-label="Why shop with us" className="border-y border-border bg-surface">
      <ul className="content-container flex flex-wrap justify-center gap-x-8 gap-y-3 py-4 lg:justify-between lg:gap-x-12">
        {items.map(({ icon: Icon, label, detail }) => (
          <li key={label} className="flex min-h-11 items-center gap-2 font-semibold">
            <Icon aria-hidden className="size-6 shrink-0 text-foreground" />
            <span>
              {label}
              {detail && <span className="font-normal text-muted-foreground"> · {detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
