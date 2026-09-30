"use client"

/** shadcn/ui Sonner toaster with the Tech Nest tokens (spec 4: "Added to basket" toast) */
import { Toaster as Sonner, toast } from "sonner"

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      // below the drawer header, so the toast never covers "Close basket"
      offset={{ top: 72 }}
      mobileOffset={{ top: 72 }}
      duration={3000}
      closeButton={false}
      toastOptions={{
        classNames: {
          toast:
            "!rounded !border !border-border !bg-background !text-foreground !text-base !shadow-lg !font-sans",
          title: "!text-base !font-semibold",
        },
      }}
    />
  )
}

export { toast }
