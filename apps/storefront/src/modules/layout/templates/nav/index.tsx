import { Suspense } from "react"
import Link from "next/link"
import { User } from "lucide-react"
import { getCurrentDevice } from "@lib/data/devices"
import CartButton from "@modules/layout/components/cart-button"
import DeviceChipSlot from "@modules/layout/components/device-chip/slot"
import Logo from "@modules/layout/components/logo"
import SideMenu from "@modules/layout/components/side-menu"
import HeaderSearch from "@modules/search/components/header-search"

export default async function Nav() {
  const current = await getCurrentDevice().catch(() => null)
  const device = current ? { label: current.model } : null

  return (
    <header className="sticky inset-x-0 top-0 z-50 border-b border-border bg-background">
      <nav
        aria-label="Main"
        className="content-container flex h-[var(--header-h)] items-center gap-1 sm:gap-2 lg:gap-6"
      >
        <div className="lg:hidden">
          <SideMenu />
        </div>
        <Logo />
        <DeviceChipSlot device={device} className="hidden lg:inline-flex" />
        <div className="ml-auto flex items-center gap-0 sm:gap-2">
          <HeaderSearch />
          <Link
            href="/account"
            className="hidden min-h-11 items-center gap-2 px-2 hover:underline lg:inline-flex"
          >
            <User aria-hidden className="size-5" />
            Account
          </Link>
          <Suspense
            fallback={
              <Link href="/cart" className="inline-flex min-h-11 items-center px-2">
                Basket
              </Link>
            }
          >
            <CartButton />
          </Suspense>
        </div>
      </nav>
      <div className="border-t border-border bg-surface px-4 py-1 lg:hidden">
        <DeviceChipSlot device={device} className="w-full justify-center bg-transparent" />
      </div>
    </header>
  )
}
