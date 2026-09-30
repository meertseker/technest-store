import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Api = {
  get: (url: string, config?: object) => Promise<{ data: any }>
  post: (url: string, body?: object, config?: object) => Promise<{ data: any }>
}

export type ShippingCode = "standard" | "next-day" | "click-collect"

/**
 * Places a real order through the store API, like a shopper: cart → address →
 * shipping option → payment session (system provider: authorised, not
 * captured) → complete. Needs the Tech Nest seed. Returns the order.
 */
export async function placeStoreOrder(
  api: Api,
  container: MedusaContainer,
  opts: { email: string; shipping: ShippingCode; quantity?: number }
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: keys } = await query.graph({
    entity: "api_key",
    fields: ["token"],
    filters: { type: "publishable" },
  })
  const headers = { headers: { "x-publishable-api-key": keys[0].token } }

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "title", "product.title"],
    pagination: { take: 1 },
  })

  const address = {
    first_name: "Sam",
    last_name: "Smith",
    address_1: "1 High St",
    city: "London",
    postal_code: "SE16 1AA",
    country_code: "gb",
  }

  const {
    data: { regions },
  } = await api.get("/store/regions", headers)
  let {
    data: { cart },
  } = await api.post("/store/carts", { region_id: regions[0].id, email: opts.email }, headers)
  await api.post(
    `/store/carts/${cart.id}/line-items`,
    { variant_id: variants[0].id, quantity: opts.quantity ?? 1 },
    headers
  )
  await api.post(`/store/carts/${cart.id}`, { shipping_address: address, billing_address: address }, headers)

  const {
    data: { shipping_options },
  } = await api.get(`/store/shipping-options?cart_id=${cart.id}`, headers)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "type.code"],
  })
  const optionId = options.find((o) => o.type?.code === opts.shipping)!.id
  if (!shipping_options.some((o: { id: string }) => o.id === optionId)) {
    throw new Error(`shipping option ${opts.shipping} is not offered for this cart`)
  }
  await api.post(`/store/carts/${cart.id}/shipping-methods`, { option_id: optionId }, headers)

  ;({
    data: { cart },
  } = await api.get(`/store/carts/${cart.id}`, headers))
  const {
    data: { payment_collection },
  } = await api.post("/store/payment-collections", { cart_id: cart.id }, headers)
  await api.post(
    `/store/payment-collections/${payment_collection.id}/payment-sessions`,
    { provider_id: "pp_system_default" },
    headers
  )

  const { data } = await api.post(`/store/carts/${cart.id}/complete`, {}, headers)
  if (data.type !== "order") {
    throw new Error(`cart did not complete: ${JSON.stringify(data.error ?? data)}`)
  }
  return data.order as { id: string; display_id: number; total: number; items: { id: string; quantity: number }[] }
}

/** The order's single payment (system provider, authorised at checkout). */
export async function orderPayment(container: MedusaContainer, orderId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["payment_collections.payments.id", "payment_collections.payments.amount"],
    filters: { id: orderId },
  })
  return data[0].payment_collections![0]!.payments![0]! as { id: string; amount: number }
}
