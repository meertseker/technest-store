import Image from "next/image"
import Link from "next/link"
import { ChevronRight, HelpCircle } from "lucide-react"
import { brandSlug } from "@/lib/devices/tree"
import type { Device, DeviceTree } from "@/lib/devices/types"
import { displayClass } from "@/lib/typography"
import DeviceSearch from "@modules/devices/components/device-search"

type Props = { tree: DeviceTree; current: Device | null }

/**
 * Home hero (docs/specs/design.md 7.1): the only hero, no carousel. The real
 * shop interior fills the band at every width (it is the LCP image: priority,
 * high fetch priority) under a dark scrim that keeps the white headline above
 * 7:1. The headline is set like the sign over the door, and the device picker
 * card below it is the page's main action: search by name, or Brand > Series
 * > Model on /devices.
 */
export default function Hero({ tree, current }: Props) {
  const brands = tree.brands.slice(0, 6)

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-foreground text-white">
      <Image
        src="/images/shop/interior-wide.jpg"
        alt=""
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        className="-z-20 object-cover object-[60%_40%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(17,24,39,0.94)_0%,rgba(17,24,39,0.82)_55%,rgba(17,24,39,0.72)_100%)] lg:bg-[linear-gradient(to_right,rgba(17,24,39,0.94)_0%,rgba(17,24,39,0.86)_42%,rgba(17,24,39,0.35)_72%,rgba(17,24,39,0.15)_100%)]"
      />

      <div className="content-container grid py-10 lg:min-h-[580px] lg:grid-cols-12 lg:items-center lg:py-14">
        <div className="lg:col-span-7 xl:col-span-6">
          <h1 id="hero-title" className={`${displayClass} max-w-[14ch]`}>
            Accessories that fit your phone.
          </h1>
          <p className="mt-4 max-w-[48ch] text-lg leading-relaxed text-white/90">
            Tell us your phone or console and we only show what fits it. Order online and collect
            free from the shop on Southwark Park Road, or have it delivered.
          </p>

          <div className="mt-7 rounded-xl bg-background p-5 text-foreground shadow-lg sm:p-6">
            {current && (
              <p className="mb-4 rounded bg-success-subtle px-3 py-2 text-success">
                Shopping for <strong className="font-semibold">{current.model}</strong>
              </p>
            )}
            <DeviceSearch
              tree={tree}
              currentSlug={current?.slug}
              label={current ? "Choose another device" : "Find your phone or console"}
            />
            {brands.length > 0 && (
              <nav aria-label="Choose by brand" className="mt-4">
                <p className="font-semibold">Or choose a brand</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {brands.map((b) => (
                    <li key={b.brand}>
                      <Link
                        href={`/devices?brand=${brandSlug(b.brand)}`}
                        className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-surface px-4 font-medium transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
                      >
                        {b.brand}
                        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <Link
              href="/devices/help"
              className="mt-3 inline-flex min-h-11 items-center gap-2 underline underline-offset-4"
            >
              <HelpCircle aria-hidden className="size-5 text-muted-foreground" />
              How do I find my model?
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
