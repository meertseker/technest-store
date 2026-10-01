"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import type { ShopMenuGroup } from "@/lib/layout/menu"
import { cn } from "@/lib/utils"

const row = "flex min-h-12 items-center rounded px-2 transition-colors duration-150 hover:bg-surface"
const heading = "px-2 pb-1 pt-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground"

/**
 * Mobile menu (below 1024px): a left-hand panel on Radix Dialog, the same
 * primitive as the basket drawer, so no second dialog library ships on every
 * page. Radix gives the focus trap, Escape, inert background and focus return.
 * It lists the whole category tree from the backend, so every part of the shop
 * is one tap away. Solid tokens for >= 4.5:1 text and 48px links (spec 4, 8).
 * No Basket: it is always in the header, never inside the menu (spec 6).
 */
export default function SideMenu({ groups = [] }: { groups?: ShopMenuGroup[] }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const item = (name: string, href: string, className?: string) => (
    <li key={href}>
      <Link
        href={href}
        onClick={close}
        data-testid={`${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-link`}
        className={cn(row, className)}
      >
        {name}
      </Link>
    </li>
  )

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        data-testid="nav-menu-button"
        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center px-1 transition-colors duration-150 hover:underline"
      >
        Menu
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          data-testid="side-menu-backdrop"
          className="fixed inset-0 z-[60] bg-foreground/50 data-[state=open]:animate-[tn-fade-in_200ms_ease-out]"
        />
        <Dialog.Content
          data-testid="nav-menu-popup"
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-[70] flex w-[min(20rem,calc(100vw-3rem))] flex-col bg-background text-foreground shadow-lg outline-none data-[state=open]:animate-[tn-slide-in-left_200ms_ease-out]"
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            <Dialog.Title className="text-lg font-semibold">Menu</Dialog.Title>
            <Dialog.Close
              aria-label="Close menu"
              data-testid="close-menu-button"
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded transition-colors duration-150 hover:bg-surface"
            >
              <X aria-hidden className="size-6" />
            </Dialog.Close>
          </div>
          <nav aria-label="Menu" className="flex-1 overflow-y-auto px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
            <ul>{item("Home", "/", "text-lg font-semibold")}</ul>
            <p className={heading} data-small-text>
              Shop
            </p>
            <ul>
              {item("All products", "/search", "font-semibold")}
              {groups.map((g) => (
                <li key={g.href}>
                  <Link href={g.href} onClick={close} className={cn(row, "font-semibold")}>
                    {g.name}
                  </Link>
                  {g.children.length > 0 && (
                    <ul className="ml-2 border-l border-border pl-2">
                      {g.children.map((c) => (
                        <li key={c.href}>
                          <Link href={c.href} onClick={close} className={row}>
                            {c.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <p className={heading} data-small-text>
              Services and help
            </p>
            <ul>
              {item("Repairs", "/repairs", "font-semibold")}
              {item("Trade", "/trade", "font-semibold")}
              {item("Account", "/account", "font-semibold")}
              {item("Contact us", "/contact", "font-semibold")}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
