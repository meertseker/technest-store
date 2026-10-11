import "server-only"
import { sdk } from "@lib/config"
import { reportUnexpected } from "@lib/monitoring/report"
import { retrieveCustomer } from "@lib/data/customer"
import { HttpTypes } from "@medusajs/types"
import { redirect } from "next/navigation"
import { getAuthHeaders } from "./cookies"

/** The signed-in customer, or a redirect to sign in that comes back to `returnTo` */
export async function requireCustomer(returnTo: string): Promise<HttpTypes.StoreCustomer> {
  const customer = await retrieveCustomer().catch(() => null)
  if (!customer) redirect(`/account/login?next=${encodeURIComponent(returnTo)}`)
  return customer
}

export const ORDERS_PER_PAGE = 10

/** GET /store/orders with the total count, newest first; null on error */
export async function listOrdersPage(
  page: number
): Promise<{ orders: HttpTypes.StoreOrder[]; count: number } | null> {
  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) return null
  try {
    const { orders, count } = await sdk.client.fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      method: "GET",
      query: {
        limit: ORDERS_PER_PAGE,
        offset: (Math.max(1, page) - 1) * ORDERS_PER_PAGE,
        order: "-created_at",
        fields: "id,display_id,created_at,status,fulfillment_status,payment_status,total,currency_code,*items,*shipping_methods",
      },
      headers,
      // an order's status changes in the admin: read fresh, never stored
      cache: "no-store",
    })
    return { orders, count }
  } catch (e) {
    await reportUnexpected(e, "account.orders")
    return null
  }
}

/** GET /store/orders/:id for the signed-in customer; null if missing or not theirs */
export async function retrieveAccountOrder(id: string): Promise<HttpTypes.StoreOrder | null> {
  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) return null
  try {
    const { order } = await sdk.client.fetch<HttpTypes.StoreOrderResponse>(
      `/store/orders/${encodeURIComponent(id)}`,
      {
        method: "GET",
        query: {
          // no payment rows: their `data` carries the payer's details and nothing here shows them
          fields:
            "*items,*items.variant,*items.product,*shipping_address,*billing_address,*shipping_methods,+customer_id",
        },
        headers,
        cache: "no-store",
      }
    )
    return order
  } catch (e) {
    await reportUnexpected(e, "account.order")
    return null
  }
}
