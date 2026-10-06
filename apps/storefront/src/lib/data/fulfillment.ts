import "server-only"

import { sdk } from "@lib/config"
import { reportUnexpected } from "@lib/monitoring/report"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders } from "./cookies"

export const listCartShippingMethods = async (cartId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<HttpTypes.StoreShippingOptionListResponse>(
      `/store/shipping-options`,
      {
        method: "GET",
        query: {
          cart_id: cartId,
        },
        headers,
        // depends on the basket's contents and address: read fresh, never stored
        cache: "no-store",
      }
    )
    .then(({ shipping_options }) => shipping_options)
    .catch(async (error) => {
      await reportUnexpected(error, "basket.delivery-options")
      return null
    })
}
