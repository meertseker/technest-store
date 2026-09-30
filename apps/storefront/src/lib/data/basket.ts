import "server-only"

import { sdk } from "@lib/config"
import { isAddonOnlyBasket, parseBasketRules } from "@lib/basket/addon"
import { DEFAULT_FREE_DELIVERY_THRESHOLD_PENCE } from "@lib/basket/free-delivery"
import {
  groupDeliveryChoices,
  type DeliveryChoice,
  type ShippingOptionLike,
} from "@lib/basket/shipping-options"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { listCartShippingMethods } from "./fulfillment"
import { getTechnestSettings } from "./technest-settings"

/** Fields the checkout needs on top of the basket (E2's payment step reads payment_collection) */
export const CHECKOUT_CART_FIELDS =
  "*items, *region, *items.product, *items.variant, *items.thumbnail, *items.metadata, +items.total, *promotions, +shipping_methods.name, *shipping_methods, *shipping_address, *billing_address, *payment_collection, *payment_collection.payment_sessions"

export type BasketView = {
  threshold_pence: number
  /** false while GET /store/technest-settings isn't deployed and the 2000 default is used */
  threshold_from_settings: boolean
  addon_only: boolean
  addon_rule_source: "backend" | "storefront"
  choices: DeliveryChoice[]
}

/**
 * E1's `GET /store/carts/:id/basket-rules` (lands on e1/basket-rules). Returns
 * null while the route is missing so the storefront fallback is used.
 */
async function getBackendBasketRules(cartId: string) {
  try {
    const body = await sdk.client.fetch<unknown>(`/store/carts/${cartId}/basket-rules`, {
      headers: { ...(await getAuthHeaders()) },
      next: { ...(await getCacheOptions("carts")) },
      cache: "force-cache",
    })
    return parseBasketRules(body)
  } catch {
    return null
  }
}

/**
 * Product ids flagged `is_addon_item` through the attributes module
 * (`+product_attributes.*`, docs/contracts/product-attributes.md). The cart's
 * line items don't carry the link, so we ask the products route. A backend
 * without the module answers 500 to that field; then we return null and the
 * item's own product metadata is used.
 */
let attributesUnsupportedUntil = 0

async function getAddonProductIds(productIds: string[]): Promise<Set<string> | null> {
  if (!productIds.length) return new Set()
  // don't ask a backend without the module on every page view
  if (Date.now() < attributesUnsupportedUntil) return null
  try {
    const { products } = await sdk.client.fetch<{
      products: { id: string; product_attributes?: { is_addon_item?: boolean } | null }[]
    }>("/store/products", {
      query: { id: productIds, fields: "id,+product_attributes.*", limit: productIds.length },
      next: { revalidate: 60 },
      cache: "force-cache",
    })
    return new Set(products.filter((p) => p.product_attributes?.is_addon_item === true).map((p) => p.id))
  } catch {
    attributesUnsupportedUntil = Date.now() + 5 * 60_000
    return null
  }
}

export async function getBasketView(cart: HttpTypes.StoreCart | null): Promise<BasketView> {
  const items = cart?.items ?? []
  const productIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean) as string[]))

  const [settings, backendRules, options, addonIds] = await Promise.all([
    getTechnestSettings(),
    cart && items.length ? getBackendBasketRules(cart.id) : Promise.resolve(null),
    cart && items.length ? listCartShippingMethods(cart.id) : Promise.resolve(null),
    items.length ? getAddonProductIds(productIds) : Promise.resolve(null),
  ])

  const addon_only = backendRules
    ? backendRules.addon_only
    : isAddonOnlyBasket(
        items as Parameters<typeof isAddonOnlyBasket>[0],
        addonIds ?? undefined
      )

  return {
    threshold_pence: settings?.free_delivery_threshold_pence ?? DEFAULT_FREE_DELIVERY_THRESHOLD_PENCE,
    threshold_from_settings: !!settings,
    addon_only,
    addon_rule_source: backendRules ? "backend" : "storefront",
    choices: groupDeliveryChoices((options ?? []) as unknown as ShippingOptionLike[]),
  }
}
