"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { pickerHref } from "@/lib/devices/cookie"
import DeviceChipLink, { type ChipDevice } from "./chip-link"

type Props = { device: ChipDevice; className?: string }

/**
 * Header device chip. Client only to know the current page (path and query
 * string), so the picker can send the shopper back to exactly where they
 * were. useSearchParams needs a Suspense boundary: render it through
 * <DeviceChipSlot>, which falls back to the bare picker link.
 */
export default function DeviceChip({ device, className }: Props) {
  const pathname = usePathname()
  const search = useSearchParams()
  const href = pickerHref(pathname, search?.toString() ?? "")
  return <DeviceChipLink device={device} href={href} className={className} />
}
