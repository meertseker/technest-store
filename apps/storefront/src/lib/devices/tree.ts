import type { Device, DeviceBrand, DeviceTree } from "./types"

export const flattenDevices = (tree: DeviceTree): Device[] =>
  tree.brands.flatMap((b) => b.series.flatMap((s) => s.devices))

export const findDevice = (tree: DeviceTree, slug: string): Device | undefined =>
  flattenDevices(tree).find((d) => d.slug === slug)

/** "Google Pixel" -> "google-pixel" (the [brand] URL segment) */
export const brandSlug = (brand: string) =>
  brand
    .toLowerCase()
    .replace(/\+/g, " plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

export const findBrand = (tree: DeviceTree, slug: string): DeviceBrand | undefined =>
  tree.brands.find((b) => brandSlug(b.brand) === slug)

export const deviceHref = (d: Pick<Device, "brand" | "slug">) =>
  `/devices/${brandSlug(d.brand)}/${d.slug}`

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

/**
 * Client-side device search: every word of the query must match the brand,
 * model, slug or an alias (ignoring case, spaces and punctuation). Exact and
 * prefix model matches rank first; then shorter (closer) models; remaining ties keep catalogue order (newest first).
 */
export function searchDevices(tree: DeviceTree, query: string, limit = 12): Device[] {
  const words = query.split(/\s+/).map(norm).filter(Boolean)
  if (!words.length) return []
  const whole = norm(query)

  const scored = flattenDevices(tree)
    .map((device, index) => {
      const hay = [device.brand, device.model, device.slug, ...device.aliases].map(norm)
      const joined = norm(device.brand + device.model)
      const allWords = words.every((w) => hay.some((h) => h.includes(w)) || joined.includes(w))
      const wholeHit = hay.some((h) => h.includes(whole)) || joined.includes(whole)
      if (!allWords && !wholeHit) return null
      const model = norm(device.model)
      const exact = model === whole || device.aliases.some((a) => norm(a) === whole)
      const rank = exact ? 0 : model.startsWith(whole) ? 1 : 2
      return { device, rank, index, len: model.length }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return scored
    .sort((a, b) => a.rank - b.rank || a.len - b.len || a.index - b.index)
    .slice(0, limit)
    .map((s) => s.device)
}
