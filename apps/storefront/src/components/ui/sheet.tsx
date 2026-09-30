"use client"

/**
 * shadcn/ui Sheet (Radix Dialog), trimmed to what the spec uses: a right-hand
 * drawer, 100% wide below 768px and 420px from 768px (spec 4, 7.4).
 * Radix gives the focus trap, Escape to close, inert background and focus return.
 */
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal
const SheetTitle = SheetPrimitive.Title
const SheetDescription = SheetPrimitive.Description

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[60] bg-foreground/50 data-[state=open]:animate-[tn-fade-in_200ms_ease-out]",
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = "SheetOverlay"

type SheetContentProps = React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
  closeLabel?: string
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ className, children, closeLabel = "Close", ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-[70] flex h-full w-full flex-col bg-background shadow-lg outline-none md:w-[420px]",
        "data-[state=open]:animate-[tn-slide-in-right_200ms_ease-out]",
        className
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close
        className="absolute right-2 top-2 inline-flex size-11 cursor-pointer items-center justify-center rounded transition-colors duration-150 hover:bg-surface"
        data-testid="sheet-close"
      >
        <X aria-hidden className="size-6" />
        <span className="sr-only">{closeLabel}</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = "SheetContent"

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger }
