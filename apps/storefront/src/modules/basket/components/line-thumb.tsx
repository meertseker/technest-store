import Image from "next/image"
import PhotoPlaceholder from "@/components/ui/photo-placeholder"
import { iconKeyFor } from "@/lib/catalogue/category-icon"

/** 72px product thumbnail on a surface tile; an icon for the item when there is no photo */
export default function LineThumb({
  src,
  title,
  size = 72,
}: {
  src?: string | null
  title?: string | null
  size?: number
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded bg-surface"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt="" fill sizes={`${size}px`} className="object-contain" loading="lazy" />
      ) : (
        <PhotoPlaceholder icon={iconKeyFor(title)} size="sm" className="absolute inset-0" />
      )}
    </div>
  )
}
