import Image from "next/image"
import Link from "next/link"
import { ChevronRight, HelpCircle } from "lucide-react"
import { brandSlug } from "@/lib/devices/tree"
import type { Device, DeviceTree } from "@/lib/devices/types"
import DeviceSearch from "@modules/devices/components/device-search"

type Props = { tree: DeviceTree; current: Device | null }

/**
 * Home hero (docs/specs/design.md 7.1): the only hero, no carousel. The shop
 * photo is the LCP image (priority, high fetch priority). At 375 it sits
 * behind the text under a dark scrim (white text on it is >= 7:1); from lg it
 * moves into the right 5/12 column. The device picker card is the page's main
 * action: search by name, or Brand > Series > Model on /devices.
 */
export default function Hero({ tree, current }: Props) {
  const brands = tree.brands.slice(0, 6)

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div className="content-container grid lg:grid-cols-12 lg:items-center lg:gap-10 lg:py-10">
        <div className="absolute inset-0 -z-10 lg:relative lg:inset-auto lg:z-auto lg:order-2 lg:col-span-5 lg:h-[500px] lg:overflow-hidden lg:rounded">
          <Image
            src="/images/shop/controller-wall.jpg"
            alt="A wall of controllers and gaming headsets inside the Tech Nest shop"
            fill
            priority
            fetchPriority="high"
            sizes="(min-width: 1280px) 480px, (min-width: 1024px) 40vw, 100vw"
            className="object-cover"
          />
          <div aria-hidden className="absolute inset-0 bg-black/70 lg:hidden" />
        </div>

        <div className="py-8 text-white lg:order-1 lg:col-span-7 lg:py-0 lg:text-foreground">
          <h1
            id="hero-title"
            className="text-[32px] font-bold leading-[1.1] tracking-[-0.01em] lg:text-5xl"
          >
            Accessories that fit your phone
          </h1>
          <p className="mt-3 max-w-[68ch] text-lg leading-relaxed">
            Tell us your phone or console and we&apos;ll show what fits it. Order online and
            collect free from our shop on Southwark Park Road.
          </p>

          <div className="mt-6 rounded border border-border bg-background p-4 text-foreground sm:p-6">
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
                        className="inline-flex min-h-11 items-center gap-1 rounded-full bg-surface px-4 transition-colors duration-150 hover:bg-surface-2"
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
