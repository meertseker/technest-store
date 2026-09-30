import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  ADDON_ONLY_MESSAGE,
  BasketRuleItem,
  BasketRules,
  BasketRuleShippingOptionRow,
  breaksAddonRule,
  evaluateBasketRules,
  isPickupOption,
} from "../../lib/basket-rules"

type Resolver = { resolve: (key: string) => any }

type CartRow = {
  id: string
  items?: ({ product_id?: string | null } | null)[] | null
  shipping_methods?: ({ shipping_option_id?: string | null } | null)[] | null
}

type ProductRow = {
  id: string
  product_attributes?: { is_addon_item?: boolean | null } | null
}

/**
 * Loads a cart's items (as add-on or not) and its chosen shipping option ids.
 * Throws not_found for an unknown cart.
 */
async function loadCart(container: Resolver, cartId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "items.product_id", "shipping_methods.shipping_option_id"],
    filters: { id: cartId },
  })
  const cart = carts[0] as CartRow | undefined
  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Cart with id: ${cartId} was not found`)
  }

  const productIds = [
    ...new Set(
      (cart.items ?? [])
        .map((item) => item?.product_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const addonProductIds = new Set<string>()
  if (productIds.length) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "product_attributes.is_addon_item"],
      filters: { id: productIds },
    })
    for (const product of products as ProductRow[]) {
      if (product.product_attributes?.is_addon_item === true) {
        addonProductIds.add(product.id)
      }
    }
  }

  const items: BasketRuleItem[] = (cart.items ?? [])
    .filter((item) => item !== null)
    .map((item) => ({
      is_addon: Boolean(item?.product_id && addonProductIds.has(item.product_id)),
    }))
  const shippingOptionIds = (cart.shipping_methods ?? [])
    .map((method) => method?.shipping_option_id)
    .filter((id): id is string => Boolean(id))

  return { items, shippingOptionIds }
}

async function loadShippingOptions(container: Resolver, ids: string[]) {
  if (!ids.length) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "type.code", "service_zone.fulfillment_set.type"],
    filters: { id: ids },
  })
  const found = new Map(
    (data as BasketRuleShippingOptionRow[]).map((option) => [option.id, isPickupOption(option)])
  )
  // An option we can't find is treated as delivery (never waive the rule).
  return ids.map((id) => ({ is_pickup: found.get(id) ?? false }))
}

/** The basket notice for a cart (read-only). */
export async function getBasketRules(container: Resolver, cartId: string): Promise<BasketRules> {
  const { items } = await loadCart(container, cartId)
  return evaluateBasketRules(items)
}

/**
 * Fails with 400 `not_allowed` when the cart is add-on only and a delivery
 * option is (or is about to be) chosen. `shippingOptionIds` replaces the
 * cart's current methods (adding a shipping method replaces the old one).
 */
export async function assertBasketRules(
  container: Resolver,
  cartId: string,
  shippingOptionIds?: string[]
) {
  const cart = await loadCart(container, cartId)
  const shipping = await loadShippingOptions(
    container,
    shippingOptionIds ?? cart.shippingOptionIds
  )
  if (breaksAddonRule(cart.items, shipping)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, ADDON_ONLY_MESSAGE)
  }
}

/** Read-only, so no compensation. */
export const getBasketRulesStep = createStep(
  "get-basket-rules",
  async (input: { cart_id: string }, { container }) => {
    return new StepResponse(await getBasketRules(container, input.cart_id))
  }
)
