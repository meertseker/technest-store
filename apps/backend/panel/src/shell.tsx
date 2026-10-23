import { CogSixTooth, ShoppingBag, Sun, Tag } from "@medusajs/icons"
import { Button, clx, Text } from "@medusajs/ui"
import type { ComponentType, ReactNode } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { TAP } from "../../src/admin/components/shop-ui"
import { type Me, useSignOut } from "./auth"

// The panel's frame: the shop's four pages and nothing else. A bar along the
// bottom on a phone (thumb reach), along the top from `md`.

type NavItem = {
  to: string
  label: string
  Icon: ComponentType<{ className?: string }>
  /** Other paths that belong to this page (detail pages). */
  also: string[]
}

export const NAV: NavItem[] = [
  { to: "/today", label: "Today", Icon: Sun, also: [] },
  { to: "/shop-orders", label: "Orders", Icon: ShoppingBag, also: ["/orders", "/repair-bookings", "/trade-applications", "/customers"] },
  { to: "/shop-products", label: "Products", Icon: Tag, also: ["/products"] },
  { to: "/shop-settings", label: "Settings", Icon: CogSixTooth, also: [] },
]

export function activeNav(pathname: string): string | null {
  const hit = NAV.find((n) => [n.to, ...n.also].some((p) => pathname === p || pathname.startsWith(`${p}/`)))
  return hit?.to ?? null
}

function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const { pathname } = useLocation()
  const active = activeNav(pathname)
  return (
    <ul className={clx("flex", variant === "bottom" ? "w-full justify-around" : "gap-1")}>
      {NAV.map(({ to, label, Icon }) => {
        const on = active === to
        return (
          <li key={to} className={variant === "bottom" ? "flex-1" : undefined}>
            <NavLink
              to={to}
              aria-current={on ? "page" : undefined}
              className={clx(
                "focus-visible:shadow-borders-interactive-with-focus flex items-center rounded-lg outline-none transition-colors",
                variant === "bottom"
                  ? "min-h-14 flex-col justify-center gap-0.5 px-1 text-xs font-medium"
                  : "txt-large-plus min-h-11 gap-2 px-3",
                on ? "text-ui-fg-base bg-ui-bg-base-pressed" : "text-ui-fg-subtle hover:bg-ui-bg-base-hover"
              )}
            >
              <Icon className={on ? "text-ui-fg-interactive" : undefined} />
              <span>{label}</span>
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}

export function Shell({ me, children }: { me: Me; children: ReactNode }) {
  const signOut = useSignOut()
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-ui-bg-base sr-only z-50 rounded-md p-3 focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Skip to the page
      </a>
      <header className="bg-ui-bg-base border-ui-border-base sticky top-0 z-30 border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/today" className="flex min-h-11 items-center gap-2 outline-none">
            <img src="/panel/favicon.svg" alt="" className="size-8" />
            <span className="flex flex-col leading-tight">
              <span className="txt-large-plus">Tech Nest</span>
              <span className="txt-small text-ui-fg-subtle">Shop panel</span>
            </span>
          </Link>
          <nav aria-label="Pages" className="hidden md:block">
            <NavLinks variant="top" />
          </nav>
          <div className="flex items-center gap-2">
            <Text size="small" className="text-ui-fg-subtle hidden max-w-48 truncate sm:block" title={me.email}>
              {me.email}
            </Text>
            <Button variant="secondary" className={TAP} onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-3 pb-28 pt-4 md:px-4 md:pb-10">
        {children}
      </main>

      <nav
        aria-label="Pages"
        className="bg-ui-bg-base border-ui-border-base fixed inset-x-0 bottom-0 z-30 border-t px-2 pb-[env(safe-area-inset-bottom)] pt-1 md:hidden"
      >
        <NavLinks variant="bottom" />
      </nav>
    </div>
  )
}
