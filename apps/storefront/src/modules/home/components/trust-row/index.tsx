import { RotateCcw, Star, Store } from "lucide-react"
import { siteConfig } from "@/lib/site-config"

/**
 * Three facts under the hero, each with a short detail line. They stack on a
 * phone and sit in a row from 640px; never a sideways scroll.
 */
export default function TrustRow() {
  const { value, count } = siteConfig.rating
  const items = [
    { icon: Store, label: "Free Click & Collect", detail: "Order online, pick up from the shop" },
    { icon: Star, label: `${value.toFixed(1)} on Google`, detail: `From ${count} customer reviews` },
    { icon: RotateCcw, label: "14-day returns", detail: "By post or at the counter" },
  ]
  return (
    <section aria-label="Why shop with us" className="border-b border-border bg-background">
      <ul className="content-container grid gap-x-8 gap-y-2 py-3 sm:grid-cols-3 sm:py-4">
        {items.map(({ icon: Icon, label, detail }) => (
          <li key={label} className="flex min-h-11 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface">
              <Icon aria-hidden className="size-5 text-foreground" />
            </span>
            <span className="leading-tight">
              <span className="block font-semibold">{label}</span>
              <span className="block text-sm text-muted-foreground" data-small-text>
                {detail}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
