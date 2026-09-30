import { Lock } from "lucide-react"
import ChevronDown from "@modules/common/icons/chevron-down"
import Logo from "@modules/layout/components/logo"

/** Minimal checkout chrome: logo, "Secure checkout", back to basket. No nav or search. */
export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative w-full bg-background small:min-h-screen">
      <header className="border-b border-border bg-background">
        <nav
          aria-label="Checkout"
          className="content-container flex h-[var(--header-h)] items-center justify-between"
        >
          {/* Full page loads out of checkout so its strict CSP isn't carried to other pages */}
          <a
            href="/basket"
            className="flex min-h-11 flex-1 basis-0 items-center gap-x-2 hover:underline"
            data-testid="back-to-cart-link"
          >
            <ChevronDown aria-hidden className="rotate-90" size={16} />
            <span className="hidden small:block">Back to basket</span>
            <span className="block small:hidden">Back</span>
          </a>
          <Logo fullReload />
          <p className="flex flex-1 basis-0 items-center justify-end gap-2 text-muted-foreground">
            <Lock aria-hidden className="size-5" />
            <span className="hidden small:inline">Secure checkout</span>
            <span className="sr-only small:hidden">Secure checkout</span>
          </p>
        </nav>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="relative outline-none"
        data-testid="checkout-container"
      >
        {children}
      </main>
    </div>
  )
}
