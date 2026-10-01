/**
 * Tiny browser event so any "Add to basket" button (PDP, cards, add-on rows)
 * can open the basket drawer (which confirms the add) without sharing React context
 * across layouts. Call `announceAddedToBasket()` after addToCart() resolves.
 */
export const BASKET_ADDED_EVENT = "technest:basket-added"

export type BasketAddedDetail = { title?: string }

export function announceAddedToBasket(detail: BasketAddedDetail = {}) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<BasketAddedDetail>(BASKET_ADDED_EVENT, { detail }))
}
