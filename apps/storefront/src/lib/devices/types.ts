/** Types from docs/contracts/devices.md (E1, draft v1) */
export type DeviceType = "phone" | "tablet" | "console" | "laptop"

export type Device = {
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

export type LinkedDevice = Device & { note: string | null }

export type DeviceSeries = { series: string; devices: Device[] }
export type DeviceBrand = { brand: string; series: DeviceSeries[] }
export type DeviceTree = { brands: DeviceBrand[]; count: number }
