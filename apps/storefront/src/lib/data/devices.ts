import "server-only"
import { cookies as nextCookies } from "next/headers"
import { cache } from "react"
import { sdk } from "@lib/config"
import { DEVICE_COOKIE, isDeviceSlug } from "@/lib/devices/cookie"
import { MOCK_DEVICE_TREE } from "@/lib/devices/mock"
import { findDevice } from "@/lib/devices/tree"
import type { Device, DeviceTree, LinkedDevice } from "@/lib/devices/types"

const EMPTY: DeviceTree = { brands: [], count: 0 }

/**
 * GET /store/devices (docs/contracts/devices.md). The catalogue is small and
 * changes rarely, so it is cached for an hour. If the route is unavailable
 * (E1's routes not merged, or the backend is down) development falls back to
 * a typed mock; production shows no devices rather than invented ones.
 */
export const listDevices = cache(async (): Promise<DeviceTree> => {
  try {
    return await sdk.client.fetch<DeviceTree>("/store/devices", {
      method: "GET",
      next: { revalidate: 3600, tags: ["devices"] },
      cache: "force-cache",
    })
  } catch {
    return process.env.NODE_ENV === "production" ? EMPTY : MOCK_DEVICE_TREE
  }
})

export async function getDeviceSlugFromCookie(): Promise<string | null> {
  try {
    const value = (await nextCookies()).get(DEVICE_COOKIE)?.value
    return isDeviceSlug(value) ? value : null
  } catch {
    return null
  }
}

/** The device the shopper chose (tn_device cookie), if it still exists */
export const getCurrentDevice = cache(async (): Promise<Device | null> => {
  const slug = await getDeviceSlugFromCookie()
  if (!slug) return null
  return findDevice(await listDevices(), slug) ?? null
})

/** GET /store/products/:id/devices; empty on any error */
export async function listProductDevices(productId: string): Promise<LinkedDevice[] | null> {
  try {
    const { devices } = await sdk.client.fetch<{ devices: LinkedDevice[] }>(
      `/store/products/${encodeURIComponent(productId)}/devices`,
      { method: "GET", next: { revalidate: 300, tags: ["devices"] }, cache: "force-cache" }
    )
    return devices
  } catch {
    // null = unknown (route missing or backend error): the UI must not claim "doesn't fit"
    return null
  }
}
