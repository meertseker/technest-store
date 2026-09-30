import { ancestry, type CategoryNode } from "./categories"

export type Group<P, C> = { category: C | null; products: P[] }

/**
 * Groups products by their most specific category (device page, spec 7:
 * "products that fit the device, grouped by category"). Groups follow the
 * category tree order (parent rank, then child rank); products without a
 * known category go last under "Other".
 */
export function groupByCategory<P extends { categories?: { id: string }[] | null }, C extends CategoryNode>(
  products: P[],
  categories: C[]
): Group<P, C>[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const groups = new Map<string, Group<P, C>>()
  for (const p of products) {
    const own = (p.categories ?? [])
      .map((c) => byId.get(c.id))
      .filter((c): c is C => !!c)
      .sort((a, b) => ancestry(categories, b).length - ancestry(categories, a).length)[0]
    const key = own?.id ?? ""
    if (!groups.has(key)) groups.set(key, { category: own ?? null, products: [] })
    groups.get(key)!.products.push(p)
  }
  const sortKey = (c: C | null) =>
    c ? ancestry(categories, c).map((x) => [x.rank ?? 0, x.name] as const) : null
  return Array.from(groups.values()).sort((a, b) => {
    const ka = sortKey(a.category)
    const kb = sortKey(b.category)
    if (!ka || !kb) return ka ? -1 : kb ? 1 : 0
    for (let i = 0; i < Math.min(ka.length, kb.length); i++) {
      const d = ka[i][0] - kb[i][0] || ka[i][1].localeCompare(kb[i][1])
      if (d) return d
    }
    return ka.length - kb.length
  })
}
