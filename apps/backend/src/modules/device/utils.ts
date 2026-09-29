export const DEVICE_TYPES = ["phone", "tablet", "console", "laptop"] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]

export type DeviceDTO = {
  id: string
  brand: string
  series: string
  model: string
  slug: string
  aliases: string[]
  type: DeviceType
  release_year: number | null
  image_url: string | null
}

export type DeviceGroup = {
  brand: string
  series: { series: string; devices: DeviceDTO[] }[]
}

/** Brands customers look for first; everything else follows A-Z. */
const BRAND_ORDER = ["Apple", "Samsung", "Google", "Sony", "Microsoft", "Nintendo"]

/** The public fields of a device, in contract order. */
export const DEVICE_FIELDS = [
  "id",
  "brand",
  "series",
  "model",
  "slug",
  "aliases",
  "type",
  "release_year",
  "image_url",
] as const

export const DEVICE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function slugifyDevice(model: string): string {
  return model
    .toLowerCase()
    .replace(/\+/g, " plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** Case-, space- and punctuation-insensitive substring match on model, slug and aliases. */
export function deviceMatchesQuery(device: DeviceDTO, q: string): boolean {
  const needle = normalize(q)
  if (!needle) {
    return true
  }
  return [device.model, device.slug, ...(device.aliases ?? [])].some((value) =>
    normalize(value).includes(needle)
  )
}

function brandRank(brand: string): number {
  const index = BRAND_ORDER.indexOf(brand)
  return index === -1 ? BRAND_ORDER.length : index
}

function compareBrand(a: string, b: string): number {
  return brandRank(a) - brandRank(b) || a.localeCompare(b)
}

function compareDevice(a: DeviceDTO, b: DeviceDTO): number {
  return (b.release_year ?? 0) - (a.release_year ?? 0) || a.model.localeCompare(b.model)
}

// A series is ordered by when it launched (its earliest device), so a late
// addition such as the iPhone 16e doesn't lift "iPhone 16" above "iPhone 17".
const years = (devices: DeviceDTO[]) => devices.map((d) => d.release_year ?? 0)
const seriesLaunch = (devices: DeviceDTO[]) => Math.min(...years(devices))
const seriesLatest = (devices: DeviceDTO[]) => Math.max(...years(devices))

/** Groups devices brand -> series -> devices in storefront display order. */
export function groupDevices(devices: DeviceDTO[]): DeviceGroup[] {
  const byBrand = new Map<string, Map<string, DeviceDTO[]>>()
  for (const device of devices) {
    const bySeries = byBrand.get(device.brand) ?? new Map<string, DeviceDTO[]>()
    bySeries.set(device.series, [...(bySeries.get(device.series) ?? []), device])
    byBrand.set(device.brand, bySeries)
  }

  return [...byBrand.entries()]
    .sort(([a], [b]) => compareBrand(a, b))
    .map(([brand, bySeries]) => ({
      brand,
      series: [...bySeries.entries()]
        .map(([series, list]) => ({ series, devices: [...list].sort(compareDevice) }))
        .sort(
          (a, b) =>
            seriesLaunch(b.devices) - seriesLaunch(a.devices) ||
            seriesLatest(b.devices) - seriesLatest(a.devices) ||
            a.series.localeCompare(b.series)
        ),
    }))
}

/** Devices flattened in the same order as `groupDevices`. */
export function sortDevices(devices: DeviceDTO[]): DeviceDTO[] {
  return groupDevices(devices).flatMap((group) =>
    group.series.flatMap((series) => series.devices)
  )
}

/** Picks the contract fields and normalizes nullable arrays. */
export function toDeviceDTO(row: Record<string, unknown>): DeviceDTO {
  return {
    id: row.id as string,
    brand: row.brand as string,
    series: row.series as string,
    model: row.model as string,
    slug: row.slug as string,
    aliases: (row.aliases as string[] | null) ?? [],
    type: row.type as DeviceType,
    release_year: (row.release_year as number | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
  }
}
