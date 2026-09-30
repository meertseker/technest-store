import Image from "next/image"
import { Package } from "lucide-react"

/** 72px product thumbnail on a surface tile; a neutral icon when there is no photo */
export default function LineThumb({ src, size = 72 }: { src?: string | null; size?: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded bg-surface"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt="" fill sizes={`${size}px`} className="object-contain" loading="lazy" />
      ) : (
        <Package aria-hidden className="absolute inset-0 m-auto size-7 text-muted-foreground" />
      )}
    </div>
  )
}
