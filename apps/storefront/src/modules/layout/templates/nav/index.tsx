import { Suspense } from "react"
import Link from "next/link"
import { User } from "lucide-react"
import { listCategories } from "@lib/data/categories"
import { getCurrentDevice } from "@lib/data/devices"
import { buildShopMenu } from "@/lib/layout/menu"
import CartButton from "@modules/layout/components/cart-button"
import DeviceChipSlot from "@modules/layout/components/device-chip/slot"
import Logo from "@modules/layout/components/logo"
import MainNav from "@modules/layout/components/main-nav"
import SideMenu from "@modules/layout/components/side-menu"
import { HeaderSearchDialog, HeaderSearchField } from "@modules/search/components/header-search"

/**
 * Sticky header (docs/specs/design.md 6), two rows at every width:
 * - below 1024px: [Menu] [logo] ... [search] [basket], then the device chip row;
 * - from 1024px: [logo] [search field] [Account] [Basket], then
 *   [Shop / Repairs / Trade] ... [device chip].
 * The second row is 53px in both layouts (--header-stack in globals.css).
 */
export default async function Nav() {
  // The header must still render when the backend is down
  const [current, categories] = await Promise.all([
    getCurrentDevice().catch(() => null),
    listCategories({ fields: "id,name,handle,rank,parent_category_id" }).catch(() => []),
  ])
  const device = current ? { label: current.model } : null
  const groups = buildShopMenu(categories)

  return (
    <header className="sticky inset-x-0 top-0 z-50 border-b border-border bg-background">
      <nav aria-label="Main">
        <div className="content-container flex h-[var(--header-h)] items-center gap-1 sm:gap-2 lg:gap-6">
          <div className="lg:hidden">
            <SideMenu groups={groups} />
          </div>
          <Logo />
          <HeaderSearchField className="mx-auto hidden w-full max-w-2xl lg:block" />
          <div className="ml-auto flex shrink-0 items-center gap-0 sm:gap-2 lg:ml-0">
            <HeaderSearchDialog />
            <Link
              href="/account"
              className="hidden min-h-11 items-center gap-2 px-2 hover:underline lg:inline-flex"
            >
              <User aria-hidden className="size-5" />
              Account
            </Link>
            <Suspense
              fallback={
                <Link href="/basket" className="inline-flex min-h-11 items-center px-2">
                  Basket
                </Link>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </div>
        <div className="relative hidden border-t border-border lg:block">
          <div className="content-container flex min-h-[52px] items-center justify-between gap-6">
            <MainNav groups={groups} className="-ml-3" />
            <DeviceChipSlot device={device} />
          </div>
        </div>
      </nav>
      <div className="border-t border-border bg-surface px-4 py-1 lg:hidden">
        <DeviceChipSlot device={device} className="w-full justify-center bg-transparent" />
      </div>
    </header>
  )
}
