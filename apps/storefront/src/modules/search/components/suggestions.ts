/** Pure helpers for the search combobox (unit-tested) */

export const MIN_QUERY = 2

export type Suggestion = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  /** GBP, major units as the index stores them (never divided) */
  price: number | null
}

type Hit = { objectID: string; [key: string]: unknown }

const str = (v: unknown) => (typeof v === "string" && v ? v : null)

/** Search hits -> suggestions; hits without a title or handle are dropped */
export function suggestionsFromHits(hits: Hit[]): Suggestion[] {
  return hits.flatMap((h) => {
    const title = str(h.title)
    const handle = str(h.handle)
    if (!title || !handle) return []
    const price = typeof h.min_price_gbp === "number" ? h.min_price_gbp : null
    return [{ id: String(h.objectID), title, handle, thumbnail: str(h.thumbnail), price }]
  })
}

/**
 * Arrow-key movement over `count` options plus the input itself (-1):
 * down from the input goes to the first option, down from the last option
 * returns to the input, and up wraps the other way.
 */
export function nextActive(current: number, dir: 1 | -1, count: number): number {
  if (count <= 0) return -1
  const positions = count + 1
  return ((((current + 1 + dir) % positions) + positions) % positions) - 1
}
