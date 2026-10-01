"use client"

import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { activeSection, type ShopMenuGroup } from "@/lib/layout/menu"
import { cn } from "@/lib/utils"

const item =
  "inline-flex min-h-11 cursor-pointer items-center gap-1 rounded px-3 font-semibold transition-colors duration-150 hover:bg-surface aria-[current]:underline aria-[current]:decoration-2 aria-[current]:underline-offset-8"
const panelLink =
  "inline-flex min-h-11 items-center rounded underline-offset-4 hover:underline"

/**
 * Desktop navigation (docs/specs/design.md 6): Shop, Repairs, Trade. Shop is a
 * disclosure (a button that shows a panel of links), not an ARIA menu, so the
 * categories stay ordinary links: Tab moves through them, Escape closes the
 * panel and returns focus to the button. The categories come from the backend;
 * with none (backend down) Shop is a plain link to all products.
 */
export default function MainNav({
  groups,
  className,
}: {
  groups: ShopMenuGroup[]
  className?: string
}) {
  const pathname = usePathname() ?? "/"
  const section = activeSection(pathname)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  // a navigation (including one from the panel) closes it
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [open])

  const current = (s: typeof section, href: string) =>
    section === s ? (pathname === href ? "page" : "true") : undefined

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {groups.length ? (
        <div
          ref={rootRef}
          onKeyDown={(e) => {
            if (e.key === "Escape" && open) {
              e.stopPropagation()
              setOpen(false)
              buttonRef.current?.focus()
            }
          }}
          onBlur={(e) => {
            if (open && e.relatedTarget && !rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false)
          }}
        >
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-current={section === "shop" ? "true" : undefined}
            onClick={() => setOpen((o) => !o)}
            className={item}
          >
            Shop
            <ChevronDown
              aria-hidden
              className={cn("size-5 transition-transform duration-150", open && "rotate-180")}
            />
          </button>
          {open && (
            <div
              id={panelId}
              className="absolute inset-x-0 top-full z-50 border-b border-border bg-background shadow-lg"
              data-testid="shop-menu"
            >
              <div className="content-container py-6">
                <ul className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-x-8 gap-y-6">
                  {groups.map((g) => (
                    <li key={g.href}>
                      <Link href={g.href} onClick={() => setOpen(false)} className={cn(panelLink, "font-semibold")}>
                        {g.name}
                      </Link>
                      {g.children.length > 0 && (
                        <ul>
                          {g.children.map((c) => (
                            <li key={c.href}>
                              <Link href={c.href} onClick={() => setOpen(false)} className={cn(panelLink, "text-muted-foreground hover:text-foreground")}>
                                {c.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex flex-wrap gap-x-8 border-t border-border pt-4">
                  <Link href="/search" onClick={() => setOpen(false)} className={cn(panelLink, "font-semibold")}>
                    All products
                  </Link>
                  <Link href="/devices" onClick={() => setOpen(false)} className={cn(panelLink, "font-semibold")}>
                    Find what fits your device
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Link href="/search" aria-current={current("shop", "/search")} className={item}>
          Shop
        </Link>
      )}
      <Link href="/repairs" aria-current={current("repairs", "/repairs")} className={item}>
        Repairs
      </Link>
      <Link href="/trade" aria-current={current("trade", "/trade")} className={item}>
        Trade
      </Link>
    </div>
  )
}
