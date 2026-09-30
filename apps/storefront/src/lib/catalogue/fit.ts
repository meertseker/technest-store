import type { LinkedDevice } from "@/lib/devices/types"

export type FitResult =
  | { kind: "fits"; device: string; note: string | null }
  | { kind: "doesnt-fit"; device: string }
  | { kind: "choose" }
  | { kind: "none" }

/**
 * Fit box state for a product page.
 * - linked === null: the device list is unknown (route missing, backend error) -> say nothing
 * - linked is empty: the product isn't device-specific (a plug charger) -> say nothing
 * - no device chosen -> "Check it fits: choose your device"
 * - otherwise fits / doesn't fit
 */
export function fitResult(
  device: { slug: string; model: string } | null,
  linked: LinkedDevice[] | null
): FitResult {
  if (!linked || !linked.length) return { kind: "none" }
  if (!device) return { kind: "choose" }
  const hit = linked.find((d) => d.slug === device.slug)
  return hit
    ? { kind: "fits", device: device.model, note: hit.note }
    : { kind: "doesnt-fit", device: device.model }
}
