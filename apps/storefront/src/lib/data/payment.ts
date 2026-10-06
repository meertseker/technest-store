import "server-only"

import { sdk } from "@lib/config"
import { reportUnexpected } from "@lib/monitoring/report"
import { getAuthHeaders } from "./cookies"
import { HttpTypes } from "@medusajs/types"

export const listCartPaymentMethods = async (regionId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<HttpTypes.StorePaymentProviderListResponse>(
      `/store/payment-providers`,
      {
        method: "GET",
        query: { region_id: regionId },
        headers,
        // The providers of a region change in the admin (e.g. when card payments
        // are switched on); checkout must see that at once.
        cache: "no-store",
      }
    )
    .then(({ payment_providers }) =>
      payment_providers.sort((a, b) => {
        return a.id > b.id ? 1 : -1
      })
    )
    .catch(async (error) => {
      // null makes checkout say "payments are unavailable": we must hear about it
      await reportUnexpected(error, "checkout.payment-providers")
      return null
    })
}
