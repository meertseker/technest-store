import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { HttpTypes } from "@medusajs/types"
import PhotoPlaceholder from "@/components/ui/photo-placeholder"
import { iconKeyFor } from "@/lib/catalogue/category-icon"
import { h2Class } from "@/lib/typography"

const imageOf = (c: HttpTypes.StoreProductCategory) => {
  const url = c.metadata?.image_url
  return typeof url === "string" && url.startsWith("https://") ? url : null
}

/**
 * "Shop by category" (docs/specs/design.md 7.1). Categories have no images in
 * the backend yet, so the default tile is one plain white card: a line icon,
 * the name and a chevron, two to a row on a phone and four from 768px. The
 * owner asked for this section to be simpler (2026-10-29), so the coloured
 * department tints are gone. Once an admin sets a `metadata.image_url` on any
 * category, every tile switches to the picture layout (4:3 image above the
 * name), with the icon standing in for the ones still without a picture. The
 * tiles themselves always come from the backend.
 */
export default function CategoryTiles({
  categories,
  hrefFor = (c) => `/c/${c.handle}`,
}: {
  categories: HttpTypes.StoreProductCategory[]
  /** canonical /c/parent/child path; the page accepts /c/<handle> too */
  hrefFor?: (c: HttpTypes.StoreProductCategory) => string
}) {
  if (!categories.length) return null
  const pictures = categories.some(imageOf)
  return (
    <section aria-labelledby="categories-heading" className="content-container section pb-0 lg:pb-0">
      <h2 id="categories-heading" className={h2Class}>
        Shop by category
      </h2>
      <ul
        data-layout={pictures ? "image" : "compact"}
        className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4"
      >
        {categories.map((c) => {
          const image = imageOf(c)
          const icon = iconKeyFor(c.handle, c.name)
          return (
            <li key={c.id} className="min-w-0">
              {pictures ? (
                <Link
                  href={hrefFor(c)}
                  className="group flex h-full flex-col rounded-lg border border-border bg-background transition-colors duration-150 hover:border-border-strong"
                >
                  <div className="relative flex aspect-[4/3] items-center justify-center rounded-t-lg bg-surface transition-colors duration-150 group-hover:bg-surface-2">
                    {image ? (
                      <Image
                        src={image}
                        alt=""
                        fill
                        loading="lazy"
                        sizes="(min-width: 1024px) 280px, 45vw"
                        className="object-contain p-4"
                      />
                    ) : (
                      <PhotoPlaceholder icon={icon} />
                    )}
                  </div>
                  <span className="flex min-h-12 items-center px-3 py-2 font-semibold">{c.name}</span>
                </Link>
              ) : (
                <Link
                  href={hrefFor(c)}
                  className="group flex h-full min-h-[72px] min-w-0 items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors duration-150 hover:border-border-strong hover:bg-surface lg:p-4"
                >
                  {/* below 640px the card is just the name: a two-column phone row has no room for the icon */}
                  <PhotoPlaceholder icon={icon} size="tile" className="hidden bg-surface text-foreground sm:flex" />
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2 font-medium leading-snug">
                    <span className="min-w-0">{c.name}</span>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                  </span>
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
