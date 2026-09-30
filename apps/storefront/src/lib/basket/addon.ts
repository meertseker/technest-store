/**
 * Add-on rule (CLAUDE.md): GBP 1 add-on items can't make up a delivery order on
 * their own. Click & Collect is exempt.
 *
 * The backend owns the rule (E1, `GET /store/carts/:id/basket-rules` on
 * e1/basket-rules). Until that route answers, the storefront detects add-ons
 * itself from the same flag the backend reads: `product_attributes.is_addon_item`
 * (docs/contracts/product-attributes.md), falling back to the provisional
 * `product.metadata.is_addon_item` the seed wrote before the attributes module
 * landed. The client-side answer only drives copy and which options are
 * offered; the backend still enforces the rule at checkout.
 */

type AddonFlagSource = {
  product_attributes?: { is_addon_item?: unknown } | null
  metadata?: Record<string, unknown> | null
} | null | undefined

export type AddonItemLike = {
  product_id?: string | null
  product?: AddonFlagSource
}

/** true only for a real boolean true (a string "true" in metadata doesn't count) */
export function isAddonProduct(product: AddonFlagSource): boolean {
  if (!product) return false
  const attr = product.product_attributes?.is_addon_item
  if (typeof attr === "boolean") return attr
  return product.metadata?.is_addon_item === true
}

/**
 * @param addonProductIds optional ids looked up separately (e.g. from
 * `/store/products?fields=+product_attributes.*`), used when the cart's line
 * items don't carry the product attributes.
 */
export function isAddonItem(item: AddonItemLike, addonProductIds?: ReadonlySet<string>): boolean {
  if (item.product_id && addonProductIds?.has(item.product_id)) return true
  return isAddonProduct(item.product)
}

/** Every line is an add-on, so delivery isn't allowed (Click & Collect still is). */
export function isAddonOnlyBasket(
  items: readonly AddonItemLike[] | null | undefined,
  addonProductIds?: ReadonlySet<string>
): boolean {
  if (!items?.length) return false
  return items.every((i) => isAddonItem(i, addonProductIds))
}

export type BasketRules = {
  /** true when the basket may not be delivered (add-on items only) */
  addon_only: boolean
  source: "backend" | "storefront"
}

/**
 * Reads the backend's answer leniently: the route is not merged yet, so we
 * accept `{ basket_rules: {...} }` or a bare object with `addon_only` or
 * `delivery_allowed`. Anything else is null and the storefront fallback is used.
 */
export function parseBasketRules(body: unknown): BasketRules | null {
  if (!body || typeof body !== "object") return null
  const root = body as Record<string, unknown>
  const r = (root.basket_rules && typeof root.basket_rules === "object"
    ? root.basket_rules
    : root) as Record<string, unknown>
  if (typeof r.addon_only === "boolean") return { addon_only: r.addon_only, source: "backend" }
  if (typeof r.delivery_allowed === "boolean") {
    return { addon_only: !r.delivery_allowed, source: "backend" }
  }
  return null
}
