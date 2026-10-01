/**
 * "Goes well with this" on the product page (docs/specs/design.md 7.3,
 * "Complete your setup"): a few things from the same part of the shop.
 */
import { isPurchasable, type VariantLike } from "./variants"

type RelatedLike = {
  id: string
  categories?: { id: string }[] | null
  variants?: VariantLike[] | null
}

/**
 * What fits the shopper's device first, then things from other subcategories
 * (a protector with a case) before more of the same; the catalogue order is
 * kept otherwise. The product itself and anything out of stock are left out.
 */
export function pickRelated<T extends RelatedLike>(
  current: RelatedLike,
  candidates: T[],
  opts: { fitIds?: Set<string> | null; limit?: number } = {}
): T[] {
  const own = new Set((current.categories ?? []).map((c) => c.id))
  const score = (p: T) =>
    (opts.fitIds?.has(p.id) ? 0 : 2) + ((p.categories ?? []).some((c) => own.has(c.id)) ? 1 : 0)
  return candidates
    .filter((p) => p.id !== current.id && (p.variants ?? []).some(isPurchasable))
    .map((p, i) => ({ p, i, s: score(p) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, opts.limit ?? 4)
    .map((x) => x.p)
}
