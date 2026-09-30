import Image from "next/image"
import Link from "next/link"
import {
  BatteryCharging,
  Cable,
  Fan,
  Gamepad2,
  Headphones,
  Keyboard,
  Laptop,
  type LucideIcon,
  ShieldCheck,
  Smartphone,
  Speaker,
  Tag,
  Usb,
} from "lucide-react"
import type { HttpTypes } from "@medusajs/types"
import { sectionTitle } from "../product-section"

/**
 * Categories have no images in the backend yet, so a tile shows the category's
 * `metadata.image_url` when an admin sets one, else an icon picked from words
 * in its handle (a fallback, not a list of categories: the tiles themselves
 * always come from the backend). First match wins, so the order matters.
 */
const ICONS: [RegExp, LucideIcon][] = [
  [/case|cover/, Smartphone],
  [/screen|glass|protector/, ShieldCheck],
  [/power-bank|battery/, BatteryCharging],
  [/headphone|headset|earphone|earbud|audio/, Headphones],
  [/speaker/, Speaker],
  [/controller|gaming|console/, Gamepad2],
  [/charg|cable/, Cable],
  [/keyboard|mice|mouse/, Keyboard],
  [/hub|adapter|usb/, Usb],
  [/cooling|fan/, Fan],
  [/laptop|computer/, Laptop],
]

const iconFor = (handle: string) => ICONS.find(([re]) => re.test(handle))?.[1] ?? Tag

const imageOf = (c: HttpTypes.StoreProductCategory) => {
  const url = c.metadata?.image_url
  return typeof url === "string" && url.startsWith("https://") ? url : null
}

export default function CategoryTiles({
  categories,
}: {
  categories: HttpTypes.StoreProductCategory[]
}) {
  if (!categories.length) return null
  return (
    <section aria-labelledby="categories-heading" className="content-container pt-12 lg:pt-20">
      <h2 id="categories-heading" className={sectionTitle}>
        Shop by category
      </h2>
      <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
        {categories.map((c) => {
          const Icon = iconFor(c.handle)
          const image = imageOf(c)
          return (
            <li key={c.id}>
              <Link
                href={`/categories/${c.handle}`}
                className="group flex h-full flex-col rounded border border-border bg-background transition-colors duration-150 hover:border-border-strong"
              >
                <div className="relative flex aspect-[4/3] items-center justify-center rounded-t bg-surface transition-colors duration-150 group-hover:bg-surface-2">
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
                    <Icon aria-hidden className="size-12 text-foreground" strokeWidth={1.5} />
                  )}
                </div>
                <span className="flex min-h-12 items-center px-3 py-2 font-semibold">{c.name}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
