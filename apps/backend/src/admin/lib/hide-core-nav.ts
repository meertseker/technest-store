/**
 * The owner's menu is Today, Orders, Products and Shop settings (our routes).
 * Medusa's own entries stay reachable by URL (our rows link to /orders/:id)
 * but are hidden from the sidebar and the mobile menu. A stylesheet, not DOM
 * surgery: a Medusa upgrade can only make an item reappear, never break the
 * page. See docs/specs/admin-four-pages.md.
 */
export const CORE_NAV_PATHS = [
  "/orders",
  "/products",
  "/collections",
  "/categories",
  "/product-options",
  "/inventory",
  "/reservations",
  "/customers",
  "/customer-groups",
  "/promotions",
  "/campaigns",
  "/price-lists",
  "/settings",
] as const

const STYLE_ID = "technest-hide-core-nav"

/** Exact-href selectors: "/app/orders" must not match our "/app/shop-orders". */
export function coreNavSelectors(basePath: string): string[] {
  const base = basePath.replace(/\/+$/, "")
  return CORE_NAV_PATHS.map((p) => `a[href="${base}${p}"]`)
}

export function hideCoreNavCss(basePath: string): string {
  // The sidebar is an <aside> (its main list in a <nav>, Settings below it);
  // the phone menu is a dialog. Medusa renders each entry as
  //   <div> <div><a href=…/> </div> [fold-out button + sub-entries, phones only] </div>
  // (dashboard NavItem: the link is hidden below `lg` when the entry has children and a
  // button takes its place), so hide that wrapper, the list item around a nested link,
  // and the link itself. Never unscoped: a breadcrumb to Orders must stay.
  const scopes = ["nav", "aside", '[role="dialog"]']
  const rules = coreNavSelectors(basePath).flatMap((s) =>
    scopes.flatMap((scope) => [
      `${scope} div:has(> div > ${s})`,
      `${scope} li:has(> div > ${s})`,
      `${scope} li:has(> ${s})`,
      `${scope} ${s}`,
    ])
  )
  return `${rules.join(",\n")} {\n  display: none !important;\n}\n`
}

/** Adds the stylesheet once. Safe to call on every page load. */
export function installHideCoreNav(doc: Document, basePath: string): void {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement("style")
  style.id = STYLE_ID
  style.textContent = hideCoreNavCss(basePath)
  doc.head.appendChild(style)
}
