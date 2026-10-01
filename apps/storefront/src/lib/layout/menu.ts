/**
 * Header navigation data (docs/specs/design.md 6): the Shop menu is built from
 * the backend's category tree, never from a hard-coded list.
 */
import { categoryPath, childrenOf, type CategoryNode } from "@/lib/catalogue/categories"

export type MenuLink = { name: string; href: string }
export type ShopMenuGroup = MenuLink & { children: MenuLink[] }

const byRank = (a: CategoryNode, b: CategoryNode) =>
  (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name)

/** Top-level categories in rank order, each with its direct subcategories */
export function buildShopMenu(categories: CategoryNode[]): ShopMenuGroup[] {
  return categories
    .filter((c) => !c.parent_category_id)
    .sort(byRank)
    .map((parent) => ({
      name: parent.name,
      href: categoryPath(categories, parent),
      children: childrenOf(categories, parent.id).map((c) => ({
        name: c.name,
        href: categoryPath(categories, c),
      })),
    }))
}

export type Section = "shop" | "repairs" | "trade" | "account"

const SECTIONS: [Section, string[]][] = [
  ["account", ["/account"]],
  ["repairs", ["/repairs"]],
  ["trade", ["/trade"]],
  ["shop", ["/c", "/p", "/search", "/devices", "/collections"]],
]

/** The header section a path belongs to, for the "you are here" highlight */
export function activeSection(pathname: string): Section | null {
  const hit = SECTIONS.find(([, roots]) =>
    roots.some((root) => pathname === root || pathname.startsWith(`${root}/`))
  )
  return hit ? hit[0] : null
}
