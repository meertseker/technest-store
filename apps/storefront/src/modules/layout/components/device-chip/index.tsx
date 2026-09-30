"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = { device: { label: string } | null; className?: string }

/**
 * "Shopping for: iPhone 15 Pro · change" (or "Choose your device").
 * Client only to know the current path, so the picker can send the shopper
 * back to where they were.
 */
export default function DeviceChip({ device, className }: Props) {
  const pathname = usePathname()
  const href =
    pathname && pathname !== "/" && !pathname.startsWith("/devices")
      ? `/devices?returnTo=${encodeURIComponent(pathname)}`
      : "/devices"

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-base text-foreground transition-colors duration-150 hover:bg-surface-2",
        className
      )}
    >
      <Smartphone aria-hidden className="size-5 shrink-0" />
      {device ? (
        <span>
          Shopping for: <strong className="font-semibold">{device.label}</strong>
          <span className="text-muted-foreground">
            {" "}
            · <span className="underline underline-offset-4">change</span>
          </span>
        </span>
      ) : (
        <span>Choose your device</span>
      )}
    </Link>
  )
}
