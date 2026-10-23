import { ArrowRightOnRectangle, ChartBar, CogSixTooth, ShoppingBag, Sun, Tag, Users } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import type { ComponentType, ReactNode } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { type Me, useSignOut } from "./auth"

// The panel's frame, in the Seker panel's layout: navigation is a glass layer
// floating over the content. From `md` a rounded sidebar on the left; on a
// phone a rounded bar along the bottom (thumb reach) and a slim top bar.

type NavItem = {
  to: string
  label: string
  Icon: ComponentType<{ className?: string }>
  /** Other paths that belong to this page (detail pages). */
  also: string[]
}

/** At most five along the bottom of a phone; Settings sits in the top bar there. */
export const NAV: NavItem[] = [
  { to: "/today", label: "Today", Icon: Sun, also: [] },
  { to: "/shop-orders", label: "Orders", Icon: ShoppingBag, also: ["/orders", "/repair-bookings", "/trade-applications"] },
  { to: "/shop-products", label: "Products", Icon: Tag, also: ["/products", "/inventory"] },
  { to: "/customers", label: "Customers", Icon: Users, also: [] },
  { to: "/sales", label: "Sales", Icon: ChartBar, also: [] },
]

export const SETTINGS: NavItem = { to: "/shop-settings", label: "Settings", Icon: CogSixTooth, also: [] }

export function activeNav(pathname: string): string | null {
  const hit = [...NAV, SETTINGS].find((n) => [n.to, ...n.also].some((p) => pathname === p || pathname.startsWith(`${p}/`)))
  return hit?.to ?? null
}

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-[#d6001c] focus-visible:ring-offset-2"

function NavLinks({ variant }: { variant: "side" | "bottom" }) {
  const { pathname } = useLocation()
  const active = activeNav(pathname)
  const items = variant === "side" ? [...NAV, SETTINGS] : NAV
  return (
    <ul className={variant === "bottom" ? "grid grid-cols-5 gap-1" : "flex flex-col gap-1"}>
      {items.map(({ to, label, Icon }) => {
        const on = active === to
        return (
          <li key={to}>
            <NavLink
              to={to}
              aria-current={on ? "page" : undefined}
              className={clx(
                "press flex items-center",
                FOCUS,
                variant === "bottom"
                  ? "min-h-12 flex-col justify-center gap-0.5 rounded-[1.25rem] px-1 py-1.5 text-[0.6875rem] font-semibold tracking-[0.01em]"
                  : "min-h-11 gap-3 rounded-xl px-3 py-2 text-[0.9375rem] font-medium",
                on
                  ? "bg-white/85 font-semibold text-[#b00017] shadow-[0_1px_2px_rgb(0_0_0/0.04),0_2px_8px_rgb(0_0_0/0.04)]"
                  : "text-ui-fg-subtle hover:text-ui-fg-base hover:bg-black/[0.04]"
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className={variant === "bottom" ? "max-w-full truncate leading-tight" : undefined}>{label}</span>
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}

function Brand({ size }: { size: "lg" | "sm" }) {
  return (
    <Link to="/today" className={clx("press flex items-center gap-2.5 rounded-xl px-2 py-1", FOCUS)}>
      <img src="/panel/favicon.svg" alt="" className={size === "lg" ? "size-9" : "size-8"} />
      <span className="flex flex-col leading-tight">
        <span className={clx("font-semibold tracking-[-0.02em] text-ui-fg-base", size === "lg" ? "text-lg" : "text-base")}>
          Tech Nest
        </span>
        <span className="text-xs font-medium text-ui-fg-subtle">Shop panel</span>
      </span>
    </Link>
  )
}

export function Shell({ me, children }: { me: Me; children: ReactNode }) {
  const signOut = useSignOut()
  const { pathname } = useLocation()
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-[80] rounded-xl bg-white px-4 py-3 font-semibold shadow-lg focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to the page
      </a>

      {/* Computer: floating glass sidebar. */}
      <aside className="glass fixed bottom-3 left-3 top-3 z-30 hidden w-[15.25rem] flex-col overflow-y-auto overscroll-contain rounded-[1.75rem] px-3 py-4 md:flex">
        <Brand size="lg" />
        <nav aria-label="Pages" className="mt-6 flex-1">
          <NavLinks variant="side" />
        </nav>
        <div className="border-t border-black/[0.06] pt-3">
          <p className="truncate px-3 text-sm font-semibold text-ui-fg-base" title={me.email}>
            {me.first_name || me.email}
          </p>
          {me.first_name && <p className="truncate px-3 text-xs text-ui-fg-subtle">{me.email}</p>}
          <button
            type="button"
            onClick={signOut}
            className={clx(
              "mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ui-fg-subtle hover:bg-black/[0.04] hover:text-ui-fg-base",
              FOCUS
            )}
          >
            <ArrowRightOnRectangle className="size-5 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Phone: slim translucent top bar. */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-[#f5f5f7]/70 px-4 py-2 backdrop-blur-2xl backdrop-saturate-150 md:hidden">
        <Brand size="sm" />
        <span className="flex-1" />
        <Link
          to={SETTINGS.to}
          aria-label="Settings"
          aria-current={activeNav(pathname) === SETTINGS.to ? "page" : undefined}
          className={clx(
            "glass flex size-11 items-center justify-center rounded-full",
            activeNav(pathname) === SETTINGS.to ? "text-[#b00017]" : "text-ui-fg-base",
            FOCUS
          )}
        >
          <CogSixTooth />
        </Link>
        <button
          type="button"
          onClick={signOut}
          className={clx("glass flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ui-fg-base", FOCUS)}
        >
          <ArrowRightOnRectangle className="size-4" />
          <span className="sr-only sm:not-sr-only">Sign out</span>
        </button>
      </header>

      <div className="md:pl-64">
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 outline-none sm:px-6 md:pb-10 md:pt-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Phone: floating glass bar along the bottom. */}
      <nav
        aria-label="Pages"
        className="glass fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-30 rounded-[1.75rem] p-1.5 md:hidden"
      >
        <NavLinks variant="bottom" />
      </nav>
    </div>
  )
}
