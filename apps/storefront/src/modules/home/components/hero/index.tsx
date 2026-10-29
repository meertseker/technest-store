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
 * Home hero, simplified on the owner's feedback (2026-10-29): the page opens
 * straight on the department cards (photo, name, "Shop now"), nothing above
 * them. The device search sits underneath as one slim row: field, button and
 * the brand chips. The H1 stays for screen readers and search engines but is
 * not shown; the cards are the headline.
 */
export default function Hero({ tree, current, categories, hrefFor }: Props) {
  const brands = tree.brands.slice(0, 6)
  const departments = categories
    .filter((c) => !c.parent_category_id && c.handle !== ONE_POUND_CATEGORY)
    .sort(byRank)
    .slice(0, 4)

  return (
    <section aria-labelledby="hero-title" className="border-b border-border bg-background">
      <h1 id="hero-title" className="sr-only">
        Accessories that fit your phone
      </h1>

      {departments.length > 0 && (
        <nav aria-label="Shop now" className="content-container pt-4 lg:pt-6">
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {departments.map((c) => {
              const photo = TILE_PHOTOS[c.handle] ?? FALLBACK_PHOTO
              return (
                <li key={c.id}>
                  <Link
                    href={hrefFor(c)}
                    className="group relative isolate flex h-full min-h-[150px] flex-col justify-end overflow-hidden rounded-xl bg-foreground p-4 text-white lg:min-h-[200px] lg:p-5"
                  >
                    <Image
                      src={photo.src}
                      alt=""
                      fill
                      priority
                      sizes="(min-width: 1280px) 290px, (min-width: 1024px) 23vw, 45vw"
                      style={{ objectPosition: photo.position }}
                      className="-z-20 object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
                    />
                    <span
                      aria-hidden
                      className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(17,24,39,0.88)_0%,rgba(17,24,39,0.45)_45%,rgba(17,24,39,0.05)_100%)]"
                    />
                    <span className="flex items-end justify-between gap-2">
                      <span className="text-lg font-semibold leading-tight lg:text-xl">
                        {c.name}
                        <span className="block text-base font-normal text-white/85">Shop now</span>
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

      <div className="content-container py-5 lg:py-6">
        {current && (
          <p className="mb-3 inline-flex rounded-full bg-success-subtle px-3 py-1 text-success">
            Shopping for <strong className="ml-1 font-semibold">{current.model}</strong>
          </p>
        )}
        <DeviceSearch
          tree={tree}
          currentSlug={current?.slug}
          label={current ? "Choose another device" : "Your phone or console"}
          compact
        />

        {brands.length > 0 && (
          <nav aria-label="Choose by brand" className="mt-3">
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
    </section>
  )
}
