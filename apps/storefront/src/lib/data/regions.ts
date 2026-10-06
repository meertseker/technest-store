import "server-only"

import { sdk } from "@lib/config"
import { STORE_COUNTRY } from "@lib/constants/store"
import { HttpTypes } from "@medusajs/types"

// Regions (and the payment providers and prices that hang off them) change in
// the admin. A short expiry means the storefront follows without a restart.
const SHARED = { revalidate: 60, tags: ["regions"] }

export const listRegions = async () => {
  return await sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      next: SHARED,
    })
    .then(({ regions }) => regions)
}

export const retrieveRegion = async (id: string) => {
  return await sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next: SHARED,
    })
    .then(({ region }) => region)
}

export const getRegion = async (countryCode: string) => {
  const regions = await listRegions()

  if (!regions) {
    return null
  }

  const wanted = countryCode || STORE_COUNTRY
  return regions.find((region) => region.countries?.some((c) => c?.iso_2 === wanted))
}
