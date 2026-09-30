import { Metadata } from "next"
import Link from "next/link"
import { Briefcase, MapPin, Package, UserRound, Wrench } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import StatusBadge from "@/components/ui/status-badge"
import { TRADE_STATUS_COPY } from "@/lib/trade/format"
import { blockLinkClass, h1Class, h2Class } from "@/lib/typography"
import { listOrdersPage, requireCustomer } from "@lib/data/account"
import { getMyTradeApplication } from "@lib/data/trade"
import OrderCard from "@modules/account/components/order-card"

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
}

export default async function AccountOverviewPage() {
  const customer = await requireCustomer("/account")
  const [ordersPage, trade] = await Promise.all([listOrdersPage(1), getMyTradeApplication()])
  const recent = ordersPage?.orders.slice(0, 3) ?? []
  const addressCount = customer.addresses?.length ?? 0

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className={h1Class}>{customer.first_name ? `Hello, ${customer.first_name}` : "Your account"}</h1>
        <p className="mt-2 break-all text-muted-foreground">Signed in as {customer.email}</p>
      </div>

      <section aria-labelledby="recent-orders">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="recent-orders" className={h2Class}>
            Recent orders
          </h2>
          {(ordersPage?.count ?? 0) > 0 && (
            <Link href="/account/orders" className={blockLinkClass}>
              See all orders<span className="sr-only"> ({ordersPage?.count})</span>
            </Link>
          )}
        </div>
        {ordersPage === null ? (
          <p className="mt-4 rounded bg-surface p-4">We could not load your orders just now. Please try again soon.</p>
        ) : recent.length === 0 ? (
          <div className="mt-4 rounded bg-surface p-6">
            <p>You have not ordered with this account yet. Orders you place while signed in will appear here.</p>
            <Link href="/" className={buttonVariants({ variant: "secondary", className: "mt-4 w-full sm:w-auto" })}>
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {recent.map((o) => (
              <li key={o.id}>
                <OrderCard order={o} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="manage">
        <h2 id="manage" className={h2Class}>
          Manage your account
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <Tile href="/account/orders" Icon={Package} title="Orders" text="Track orders and see receipts" />
          <Tile
            href="/account/addresses"
            Icon={MapPin}
            title="Addresses"
            text={addressCount ? `${addressCount} saved ${addressCount === 1 ? "address" : "addresses"}` : "Save an address for faster checkout"}
          />
          <Tile href="/account/profile" Icon={UserRound} title="Your details" text="Name, phone and password" />
          <Tile
            href="/account/trade"
            Icon={Briefcase}
            title="Trade account"
            text={trade ? undefined : "Buying for a business? Apply for trade prices"}
            badge={trade ? <StatusBadge tone={TRADE_STATUS_COPY[trade.status].tone}>{TRADE_STATUS_COPY[trade.status].label}</StatusBadge> : undefined}
          />
        </ul>
      </section>

      <section aria-labelledby="repairs-cta" className="flex flex-col gap-3 rounded bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="repairs-cta" className="flex items-center gap-2 text-lg font-semibold">
            <Wrench aria-hidden className="size-5" />
            Need a repair?
          </h2>
          <p>Most repairs are done the same day at our shop.</p>
        </div>
        <Link href="/repairs" className={buttonVariants({ variant: "secondary", className: "w-full sm:w-auto" })}>
          Book a repair
        </Link>
      </section>
    </div>
  )
}

function Tile({
  href,
  Icon,
  title,
  text,
  badge,
}: {
  href: string
  Icon: typeof Package
  title: string
  text?: string
  badge?: React.ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full min-h-[88px] items-start gap-3 rounded border border-border p-4 transition-colors duration-150 hover:bg-surface"
      >
        <Icon aria-hidden className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
        <span className="flex flex-col gap-1">
          <span className="font-semibold">{title}</span>
          {text && <span className="text-muted-foreground">{text}</span>}
          {badge && <span>{badge}</span>}
        </span>
      </Link>
    </li>
  )
}
