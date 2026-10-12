import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { HttpTypes } from "@medusajs/types"
import PhotoPlaceholder from "@/components/ui/photo-placeholder"
import { iconKeyFor } from "@/lib/catalogue/category-icon"
import { h2Class } from "@/lib/typography"

/** Department tint by the top-level handle (the first segment of the tile's path) */
const TINTS: Record<string, string> = {
  "phone-accessories": "phone",
  audio: "audio",
  gaming: "gaming",
  "computer-laptop": "computer",
}
const tintFor = (href: string) => TINTS[href.split("/")[2] ?? ""] ?? "other"

const imageOf = (c: HttpTypes.StoreProductCategory) => {
  const url = c.metadata?.image_url
  return typeof url === "string" && url.startsWith("https://") ? url : null
}

/**
 * "Shop by category" (docs/specs/design.md 7.1). Categories have no images in
 * the backend yet, so the default tile is an icon disc and the name, two to a
 * row on a phone and four from 1024px. Once an admin sets a
 * `metadata.image_url` on any category, every tile switches to the picture
 * layout (4:3 image above the name), with the icon standing in for the ones
 * still without a picture. The tiles themselves always come from the backend.
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
            <li key={c.id}>
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
                  style={
                    {
                      "--tint": `var(--tint-${tintFor(hrefFor(c))})`,
                      "--tint-ink": `var(--tint-${tintFor(hrefFor(c))}-ink)`,
                    } as React.CSSProperties
                  }
                  className="group flex h-full min-h-[116px] flex-col justify-between gap-3 rounded-lg bg-[image:var(--tint)] p-4 transition-[box-shadow,transform] duration-150 hover:shadow-[inset_0_0_0_2px_var(--tint-ink)]"
                >
                  <PhotoPlaceholder
                    icon={icon}
                    size="tile"
                    className="bg-background/80 text-[color:var(--tint-ink)]"
                  />
                  <span className="flex items-center justify-between gap-2 font-semibold leading-snug">
                    {c.name}
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-[color:var(--tint-ink)]" />
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
