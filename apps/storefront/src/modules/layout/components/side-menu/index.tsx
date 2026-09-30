"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const ITEMS = [
  { name: "Home", href: "/" },
  { name: "Shop", href: "/search" },
  { name: "Repairs", href: "/repairs" },
  { name: "Trade", href: "/trade" },
  { name: "Account", href: "/account" },
  // no Basket: it is always in the header, never inside the menu (spec 6)
]

/**
 * Mobile menu (below 1024px): a left-hand panel on Radix Dialog, the same
 * primitive as the basket drawer, so no second dialog library ships on every
 * page. Radix gives the focus trap, Escape, inert background and focus return.
 * Solid tokens for >= 4.5:1 text and 48px links (spec 4, 8).
 */
export default function SideMenu() {
  const [open, setOpen] = useState(false)
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
          className="fixed inset-y-0 left-0 z-[70] flex w-[min(20rem,calc(100vw-3rem))] flex-col bg-background p-4 text-foreground shadow-lg outline-none data-[state=open]:animate-[tn-slide-in-left_200ms_ease-out]"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Menu</Dialog.Title>
            <Dialog.Close
              aria-label="Close menu"
              data-testid="close-menu-button"
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded transition-colors duration-150 hover:bg-surface"
            >
              <X aria-hidden className="size-6" />
            </Dialog.Close>
          </div>
          <nav aria-label="Menu" className="mt-4">
            <ul className="flex flex-col gap-2">
              {ITEMS.map(({ name, href }) => (
                <li key={name}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    data-testid={`${name.toLowerCase()}-link`}
                    className="flex min-h-12 items-center rounded px-2 text-2xl font-semibold transition-colors duration-150 hover:bg-surface"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
