/**
 * Free-delivery progress bar maths (spec 7.4). Everything is integer pence.
 *
 * The threshold comes from GET /store/technest-settings
 * (docs/contracts/settings.md, `free_delivery_threshold_pence`). Until that
 * route is deployed we fall back to the contract default, 2000 (GBP 20).
 * The bar is copy only: the real delivery price always comes from Medusa's
 * shipping options.
 */
export const DEFAULT_FREE_DELIVERY_THRESHOLD_PENCE = 2000

export type FreeDeliveryProgress = {
  /** pence still to add; 0 once qualified */
  remaining_pence: number
  /** 0..100, whole number, for aria-valuenow and the bar width */
  percent: number
  qualified: boolean
}

export function freeDeliveryProgress(
  subtotal_pence: number,
  threshold_pence: number
): FreeDeliveryProgress {
  const subtotal = Math.max(0, Math.round(subtotal_pence))
  const threshold = Math.max(0, Math.round(threshold_pence))
  if (threshold === 0 || subtotal >= threshold) {
    return { remaining_pence: 0, percent: 100, qualified: true }
  }
  return {
    remaining_pence: threshold - subtotal,
    // floor, so the bar never shows 100% while money is still missing
    percent: Math.floor((subtotal / threshold) * 100),
    qualified: false,
  }
}
