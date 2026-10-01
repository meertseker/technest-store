"use client"

import { ShoppingBag } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { HttpTypes } from "@medusajs/types"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { BASKET_ADDED_EVENT } from "@lib/basket/events"
import type { BasketView } from "@lib/data/basket"
import BasketPanel, { itemCount } from "./basket-panel"

/**
 * Header basket button + drawer (spec 6, 7.4).
 * - The button is a real link to /basket (works without JS); with JS it opens the Sheet.
 * - The count is announced by ONE visually hidden status region with a full
 *   phrase ("2 items in your basket"); the visible badge is aria-hidden.
 * - An "Add to basket" anywhere dispatches BASKET_ADDED_EVENT: we open the
 *   drawer with "Added to basket" at the top of it (no floating toast: on a
 *   phone it covered the free-delivery bar).
 */
export default function BasketDrawer({
  cart,
  view,
}: {
  cart: HttpTypes.StoreCart | null
  view: BasketView
}) {
  const [open, setOpen] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const triggerRef = useRef<HTMLAnchorElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const pathname = usePathname()
  const count = itemCount(cart)
  const phrase = `${count} ${count === 1 ? "item" : "items"} in your basket`

  const openDrawer = () => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOpen(true)
  }

  useEffect(() => {
    const onAdded = () => {
      setJustAdded(true)
      openDrawer()
    }
    window.addEventListener(BASKET_ADDED_EVENT, onAdded)
    return () => window.removeEventListener(BASKET_ADDED_EVENT, onAdded)
  }, [])

  // a navigation (e.g. a product link inside the drawer) closes it
  useEffect(() => setOpen(false), [pathname])

  return (
    <>
      <a
        ref={triggerRef}
        href="/basket"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault()
          openDrawer()
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-1.5 hover:underline sm:gap-2 sm:px-2"
        data-testid="nav-cart-link"
      >
        <ShoppingBag aria-hidden className="size-5" />
        <span>Basket</span>
        <span
          aria-hidden
          className="min-w-6 rounded-full bg-foreground px-1.5 text-center text-sm font-semibold leading-6 text-background tabular-nums"
          data-testid="nav-cart-count"
        >
          {count}
        </span>
        <span className="sr-only">, {phrase}</span>
      </a>
      <span role="status" aria-atomic="true" className="sr-only" data-testid="basket-status">
        {phrase}
      </span>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setJustAdded(false)
        }}
      >
        <SheetContent
          closeLabel="Close basket"
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            const back = returnFocusRef.current
            ;(back && back.isConnected ? back : triggerRef.current)?.focus()
          }}
          data-testid="basket-drawer"
        >
          <BasketPanel
            cart={cart}
            view={view}
            justAdded={justAdded}
            heading={
              <>
                <SheetTitle className="text-lg font-semibold leading-[44px] lg:text-xl">
                  Your basket ({count})
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Review your items, then check out securely.
                </SheetDescription>
              </>
            }
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
