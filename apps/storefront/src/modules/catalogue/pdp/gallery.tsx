"use client"

import Image from "next/image"
import { Package } from "lucide-react"
import { useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type GalleryImage = { id: string; url: string }

const SIZES = "(min-width: 1024px) 700px, 100vw"

/**
 * Product gallery (docs/specs/design.md 7.3). 375: a swipeable 1:1 strip
 * (CSS scroll snap, no library) with "1 / 5". 1280: main image with vertical
 * thumbnails. Photos show the product on white (photo-worker output) on the
 * surface tile; alt text is the product title (the image adds nothing a
 * screen reader user misses otherwise, but an empty alt on the only image
 * of a product page reads as broken).
 */
export default function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [active, setActive] = useState(0)
  const track = useRef<HTMLUListElement>(null)

  if (!images.length) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded bg-surface text-muted-foreground">
        <Package aria-hidden className="size-16" strokeWidth={1.25} />
        <span>Photo coming soon</span>
      </div>
    )
  }

  const alt = (i: number) => (images.length > 1 ? `${title}, image ${i + 1} of ${images.length}` : title)

  const onScroll = () => {
    const el = track.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== active) setActive(Math.min(Math.max(i, 0), images.length - 1))
  }

  return (
    <div>
      {/* Mobile and tablet: swipe */}
      <div className="relative lg:hidden">
        <ul
          ref={track}
          onScroll={onScroll}
          className="no-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto md:mx-0"
          aria-label={`${title} images`}
        >
          {images.map((img, i) => (
            <li key={img.id} className="w-full shrink-0 snap-center px-4 md:px-0">
              <div className="relative aspect-square overflow-hidden rounded bg-surface">
                <Image
                  src={img.url}
                  alt={alt(i)}
                  fill
                  sizes={SIZES}
                  priority={i === 0}
                  loading={i === 0 ? undefined : "lazy"}
                  className="object-contain p-4"
                />
              </div>
            </li>
          ))}
        </ul>
        {images.length > 1 && (
          <div className="mt-2 flex items-center justify-center gap-3">
            <div className="flex gap-1.5" aria-hidden>
              {images.map((img, i) => (
                <span
                  key={img.id}
                  className={cn(
                    "size-2 rounded-full transition-colors duration-150",
                    i === active ? "bg-foreground" : "bg-border-strong/40"
                  )}
                />
              ))}
            </div>
            <span className="text-sm tabular-nums text-muted-foreground">
              {active + 1} / {images.length}
            </span>
          </div>
        )}
      </div>

      {/* Desktop: vertical thumbnails + main image */}
      <div className={cn("hidden lg:grid lg:gap-4", images.length > 1 && "lg:grid-cols-[80px_1fr]")}>
        {images.length > 1 && (
          <ul className="flex flex-col gap-3" aria-label="Choose an image">
            {images.map((img, i) => (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-current={i === active ? "true" : undefined}
                  aria-label={`Show image ${i + 1} of ${images.length}`}
                  className={cn(
                    "relative block aspect-square w-20 cursor-pointer overflow-hidden rounded border-2 bg-surface",
                    i === active ? "border-foreground" : "border-transparent hover:border-border-strong"
                  )}
                >
                  <Image src={img.url} alt="" fill sizes="80px" className="object-contain p-1" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="relative aspect-square overflow-hidden rounded bg-surface">
          <Image
            src={images[active].url}
            alt={alt(active)}
            fill
            sizes={SIZES}
            priority={active === 0}
            className="object-contain p-6"
          />
        </div>
      </div>
    </div>
  )
}
