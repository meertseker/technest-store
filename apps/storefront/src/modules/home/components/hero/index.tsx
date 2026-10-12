import Image from "next/image"
import Link from "next/link"
import { ChevronRight, HelpCircle } from "lucide-react"
import type { HttpTypes } from "@medusajs/types"
import { brandSlug } from "@/lib/devices/tree"
import type { Device, DeviceTree } from "@/lib/devices/types"
import { ONE_POUND_CATEGORY } from "@/lib/home/select"
import DeviceSearch from "@modules/devices/components/device-search"

/**
 * Real shop photos for the department tiles (docs/specs/design.md 5): the
 * case wall for phone accessories, the speaker shelves for audio, the
 * controller wall for gaming; the accessories aisle for anything else.
 */
const TILE_PHOTOS: Record<string, { src: string; position: string }> = {
  "phone-accessories": { src: "/images/shop/case-wall.jpg", position: "50% 60%" },
  audio: { src: "/images/shop/interior-audio.jpg", position: "40% 45%" },
  gaming: { src: "/images/shop/controller-wall.jpg", position: "50% 45%" },
}
const FALLBACK_PHOTO = { src: "/images/shop/aisle-accessories.jpg", position: "50% 50%" }

type Category = HttpTypes.StoreProductCategory

type Props = {
  tree: DeviceTree
  current: Device | null
  /** the backend's category tree; the hero links straight into it */
  categories: Category[]
  hrefFor: (c: Category) => string
  /** kept for the visit band; the hero itself no longer shows the opening status */
  now?: Date
}

const byRank = (a: Category, b: Category) => (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name)

/**
 * Home hero (docs/specs/design.md 7.1, rebuilt 2026-10-12): no photo, no
 * carousel, one job: get the shopper to the right products. Left: the
 * headline, the device search (the page's main action) and the brands.
 * Right: four ways straight into the shop: the £1 range and the three
 * biggest departments, all from the backend. Light surface so the red
 * tile and the black search button are the only strong colours.
 */
export default function Hero({ tree, current, categories, hrefFor }: Props) {
  const brands = tree.brands.slice(0, 6)
  const onePound = categories.find((c) => c.handle === ONE_POUND_CATEGORY) ?? null
  const departments = categories
    .filter((c) => !c.parent_category_id && c.handle !== ONE_POUND_CATEGORY)
    .sort(byRank)
    .slice(0, onePound ? 3 : 4)

  return (
    <section aria-labelledby="hero-title" className="border-b border-border bg-surface">
      <div className="content-container grid gap-8 py-8 lg:grid-cols-12 lg:gap-12 lg:py-12">
        <div className="lg:col-span-7">
          <h1
            id="hero-title"
            className="font-display text-[32px] font-extrabold leading-[1.05] tracking-[-0.025em] lg:text-[44px]"
          >
            Accessories that fit your phone
          </h1>
          <p className="mt-3 max-w-[48ch] text-lg text-muted-foreground">
            Tell us your phone or console and we only show what fits.
          </p>

          <div className="mt-6">
            {current && (
              <p className="mb-3 inline-flex rounded-full bg-success-subtle px-3 py-1 text-success">
                Shopping for <strong className="ml-1 font-semibold">{current.model}</strong>
              </p>
            )}
            <DeviceSearch
              tree={tree}
              currentSlug={current?.slug}
              label={current ? "Choose another device" : "Your phone or console"}
            />
          </div>

          {brands.length > 0 && (
            <nav aria-label="Choose by brand" className="mt-4">
              <ul className="flex flex-wrap gap-2">
                {brands.map((b) => (
                  <li key={b.brand}>
                    <Link
                      href={`/devices?brand=${brandSlug(b.brand)}`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-background px-4 font-medium transition-colors duration-150 hover:border-border-strong"
                    >
                      {b.brand}
                      <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/devices/help"
                    className="inline-flex min-h-11 items-center gap-1.5 px-2 underline underline-offset-4"
                  >
                    <HelpCircle aria-hidden className="size-5 text-muted-foreground" />
                    How do I find my model?
                  </Link>
                </li>
              </ul>
            </nav>
          )}

        </div>

        {(onePound || departments.length > 0) && (
          <nav aria-label="Shop now" className="lg:col-span-5">
            <ul className="grid grid-cols-2 gap-3 lg:gap-4">
              {onePound && (
                <li>
                  <Link
                    href={`/c/${ONE_POUND_CATEGORY}`}
                    className="flex h-full min-h-[132px] flex-col justify-between rounded-xl bg-brand p-4 text-brand-foreground transition-colors duration-150 hover:bg-brand-hover lg:min-h-[164px] lg:p-5"
                  >
                    <span className="font-display text-[40px] font-extrabold leading-none tracking-[-0.03em] lg:text-[52px]">
                      {/* the pound sign in Inter: the display face's £ reads as an ampersand at this size */}
                      <span className="font-sans font-bold">£</span>1
                    </span>
                    <span className="flex items-end justify-between gap-2">
                      <span className="font-semibold leading-tight">
                        each
                        <span className="block font-normal text-brand-foreground/85">Everyday essentials</span>
                      </span>
                      <ChevronRight aria-hidden className="size-5 shrink-0" />
                    </span>
                  </Link>
                </li>
              )}
              {departments.map((c) => {
                const photo = TILE_PHOTOS[c.handle] ?? FALLBACK_PHOTO
                return (
                  <li key={c.id}>
                    <Link
                      href={hrefFor(c)}
                      className="group relative isolate flex h-full min-h-[132px] flex-col justify-end overflow-hidden rounded-xl bg-foreground p-4 text-white lg:min-h-[164px] lg:p-5"
                    >
                      <Image
                        src={photo.src}
                        alt=""
                        fill
                        loading="lazy"
                        sizes="(min-width: 1024px) 260px, 45vw"
                        style={{ objectPosition: photo.position }}
                        className="-z-20 object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
                      />
                      <span
                        aria-hidden
                        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(17,24,39,0.88)_0%,rgba(17,24,39,0.45)_45%,rgba(17,24,39,0.05)_100%)]"
                      />
                      <span className="flex items-end justify-between gap-2">
                        <span className="font-display text-lg font-bold leading-tight tracking-[-0.01em] lg:text-xl">
                          {c.name}
                          <span className="block font-sans text-base font-normal tracking-normal text-white/85">Shop now</span>
                        </span>
                        <ChevronRight aria-hidden className="size-5 shrink-0" />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}
      </div>
    </section>
  )
}
