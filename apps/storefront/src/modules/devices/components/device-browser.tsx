import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { brandSlug, findBrand } from "@/lib/devices/tree"
import type { DeviceTree } from "@/lib/devices/types"
import DeviceOptions from "./device-options"

type Props = {
  tree: DeviceTree
  brand?: string
  series?: string
  returnTo?: string | null
  currentSlug?: string | null
}

const stepLink =
  "flex min-h-12 items-center justify-between gap-3 rounded border border-border bg-background px-4 py-2 font-semibold transition-colors duration-150 hover:border-border-strong hover:bg-surface"

/** Brand -> series -> model, as plain links (server-rendered, no JS needed) */
export default function DeviceBrowser({ tree, brand, series, returnTo, currentSlug }: Props) {
  const href = (params: Record<string, string>) => {
    const sp = new URLSearchParams(params)
    if (returnTo) sp.set("returnTo", returnTo)
    const qs = sp.toString()
    return qs ? `/devices?${qs}` : "/devices"
  }
  const b = brand ? findBrand(tree, brand) : undefined
  const s = b && series ? b.series.find((x) => x.series === series) : undefined

  if (!b) {
    return (
      <section aria-labelledby="browse-brand">
        <h2 id="browse-brand" className="text-xl font-semibold">
          Or choose a brand
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tree.brands.map((x) => (
            <li key={x.brand}>
              <Link href={href({ brand: brandSlug(x.brand) })} className={stepLink}>
                {x.brand}
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  const back = s ? href({ brand: brandSlug(b.brand) }) : href({})
  return (
    <section aria-labelledby="browse-step">
      <Link href={back} className="inline-flex min-h-11 items-center gap-1 hover:underline">
        <ChevronLeft aria-hidden className="size-5" />
        {s ? `All ${b.brand} models` : "All brands"}
      </Link>
      <h2 id="browse-step" className="mt-1 text-xl font-semibold">
        {s ? `Choose your ${s.series}` : `Choose your ${b.brand} series`}
      </h2>
      {s ? (
        <div className="mt-3">
          <DeviceOptions devices={s.devices} returnTo={returnTo} currentSlug={currentSlug} />
        </div>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {b.series.map((x) => (
            <li key={x.series}>
              <Link
                href={href({ brand: brandSlug(b.brand), series: x.series })}
                className={stepLink}
              >
                {x.series}
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
