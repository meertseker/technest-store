"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Briefcase, LayoutGrid, LogOut, MapPin, Package, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"

export const ACCOUNT_LINKS = [
  { href: "/account", label: "Overview", Icon: LayoutGrid },
  { href: "/account/orders", label: "Orders", Icon: Package },
  { href: "/account/addresses", label: "Addresses", Icon: MapPin },
  { href: "/account/profile", label: "Your details", Icon: UserRound },
  { href: "/account/trade", label: "Trade account", Icon: Briefcase },
] as const

export const isCurrent = (pathname: string, href: string) =>
  href === "/account" ? pathname === "/account" : pathname === href || pathname.startsWith(`${href}/`)

/**
 * Account section navigation: chips that wrap on mobile (never a clipped
 * scrolling row, spec 8), a vertical list from lg. The current page is
 * marked with aria-current and a heavier style, not colour alone.
 */
export default function AccountNav({ signOut }: { signOut: () => Promise<void> }) {
  const pathname = usePathname() ?? "/account"
  return (
    <nav aria-label="Your account">
      <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
        {ACCOUNT_LINKS.map(({ href, label, Icon }) => {
          const current = isCurrent(pathname, href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 transition-colors duration-150 lg:w-full lg:rounded lg:border-transparent",
                  current
                    ? "border-foreground bg-foreground font-semibold text-background lg:bg-surface lg:text-foreground lg:shadow-[inset_3px_0_0_var(--foreground)]"
                    : "border-border bg-surface hover:bg-surface-2 lg:bg-transparent"
                )}
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </Link>
            </li>
          )
        })}
        <li>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-4 transition-colors duration-150 hover:bg-surface lg:w-full lg:rounded lg:border-transparent"
            >
              <LogOut aria-hidden className="size-5" />
              Sign out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  )
}
