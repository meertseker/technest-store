/**
 * The add-on basket rule (CLAUDE.md): "Add-on (GBP 1) items can't make up a
 * delivery order on their own. Click & Collect is exempt."
 *
 * An item is an add-on when its product has `product_attributes.is_addon_item`
 * (ADR 0001). A shipping option is Click & Collect when it belongs to a
 * `pickup` fulfillment set (docs/contracts/click-collect.md) or its type code is
 * `click-collect`. Contract: docs/contracts/basket-rules.md.
 */

export const ADDON_ONLY_MESSAGE =
  "£1 add-ons can't be delivered on their own. Add another item to your basket, or choose Click & Collect (free)."

export const CLICK_COLLECT_TYPE_CODE = "click-collect"

/** What the storefront reads from `GET /store/carts/:id/basket-rules`. */
export type BasketRules = {
  /** Every line item is an add-on (false for an empty basket). */
  addon_only: boolean
  /** Delivery (Standard, Next-day) may be chosen. Click & Collect always may. */
  delivery_allowed: boolean
  /** Text for the basket/checkout notice; null when there is nothing to say. */
  message: string | null
}

export type BasketRuleItem = { is_addon: boolean }
export type BasketRuleShippingOption = { is_pickup: boolean }

export type BasketRuleShippingOptionRow = {
  id: string
  type?: { code?: string | null } | null
  service_zone?: { fulfillment_set?: { type?: string | null } | null } | null
}

export function isPickupOption(option: BasketRuleShippingOptionRow): boolean {
  return (
    option.service_zone?.fulfillment_set?.type === "pickup" ||
    option.type?.code === CLICK_COLLECT_TYPE_CODE
  )
}

export function evaluateBasketRules(items: BasketRuleItem[]): BasketRules {
  const addonOnly = items.length > 0 && items.every((item) => item.is_addon)
  return {
    addon_only: addonOnly,
    delivery_allowed: !addonOnly,
    message: addonOnly ? ADDON_ONLY_MESSAGE : null,
  }
}

/**
 * The rule is broken when the basket is add-on only and any chosen shipping
 * option is a delivery option. No shipping chosen yet is not a violation.
 */
export function breaksAddonRule(
  items: BasketRuleItem[],
  shipping: BasketRuleShippingOption[]
): boolean {
  return (
    !evaluateBasketRules(items).delivery_allowed &&
    shipping.some((option) => !option.is_pickup)
  )
}
