/**
 * Category tree helpers for /c/[...slug]. The canonical path is the chain of
 * handles from the top-level category down: /c/phone-accessories/cases.
 * Handles are unique in Medusa, so any path ending in a category's handle
 * finds it; the page links rel=canonical to the full path.
 */
import type { CategoryFacet } from "./facets"

export type CategoryNode = {
  id: string
  name: string
  handle: string
  rank?: number | null
  parent_category_id?: string | null
  description?: string | null
}

const byRank = (a: CategoryNode, b: CategoryNode) =>
  (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name)

export function childrenOf<T extends CategoryNode>(all: T[], id: string): T[] {
  return all.filter((c) => c.parent_category_id === id).sort(byRank)
}

/** Top-level first, the category itself last */
export function ancestry<T extends CategoryNode>(all: T[], category: T): T[] {
  const byId = new Map(all.map((c) => [c.id, c]))
  const chain: T[] = [category]
  const seen = new Set([category.id])
  let parentId = category.parent_category_id
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId)
    if (!parent) break
    chain.unshift(parent)
    seen.add(parent.id)
    parentId = parent.parent_category_id
  }
  return chain
}

export function categoryPath<T extends CategoryNode>(all: T[], category: T): string {
  return `/c/${ancestry(all, category)
    .map((c) => encodeURIComponent(c.handle))
    .join("/")}`
}

/** The category and every category below it */
export function descendantIds<T extends CategoryNode>(all: T[], id: string): string[] {
  const out = [id]
  for (let i = 0; i < out.length; i++) {
    for (const c of all) if (c.parent_category_id === out[i] && !out.includes(c.id)) out.push(c.id)
  }
  return out
}

export type ResolvedCategory<T> = { category: T; canonical: string; exact: boolean }

/**
 * Finds the category for URL segments. The last segment is the handle; the
 * earlier ones must be its ancestors in order (a shorter suffix such as
 * /c/cases is accepted too). Anything else is not found.
 */
export function resolveCategory<T extends CategoryNode>(
  all: T[],
  segments: string[]
): ResolvedCategory<T> | null {
  const handles = segments.map((s) => decodeURIComponent(s).toLowerCase())
  const last = handles[handles.length - 1]
  const category = all.find((c) => c.handle.toLowerCase() === last)
  if (!category) return null
  const chain = ancestry(all, category).map((c) => c.handle.toLowerCase())
  const suffix = chain.slice(chain.length - handles.length)
  if (handles.length > chain.length || suffix.join("/") !== handles.join("/")) return null
  return {
    category,
    canonical: categoryPath(all, category),
    exact: handles.length === chain.length,
  }
}

/** Sub-category facet for a listing: each descendant maps to the direct child it sits under */
export function subcategoryFacet<T extends CategoryNode>(all: T[], id: string): CategoryFacet | null {
  const children = childrenOf(all, id)
  if (!children.length) return null
  const map: CategoryFacet = new Map()
  for (const child of children) {
    for (const d of descendantIds(all, child.id)) {
      map.set(d, { value: child.handle, label: child.name })
    }
  }
  return map
}
