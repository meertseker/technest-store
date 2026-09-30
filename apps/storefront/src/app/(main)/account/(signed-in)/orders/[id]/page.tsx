import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Package, Phone, Store, Truck } from "lucide-react"
import { HttpTypes } from "@medusajs/types"
import StatusBadge from "@/components/ui/status-badge"
import { formatMoney, formatOrderDate, isClickAndCollect, orderStatus } from "@/lib/account/orders"
import { siteConfig } from "@/lib/site-config"
import { blockLinkClass, h1Class, h2Class } from "@/lib/typography"
import { requireCustomer, retrieveAccountOrder } from "@lib/data/account"

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false },
}

type Props = { params: Promise<{ id: string }> }

/** E2's emails link here: /account/orders/{id} (docs/contracts/emails.md) */
export default async function AccountOrderPage({ params }: Props) {
  const { id } = await params
  const customer = await requireCustomer(`/account/orders/${encodeURIComponent(id)}`)
  const order = await retrieveAccountOrder(id)
  // Store order routes return any order by id: only show the customer's own
  if (!order || order.customer_id !== customer.id) notFound()

  const status = orderStatus(order)
  const collect = isClickAndCollect(order)
  const cur = order.currency_code

  return (
    <div className="flex flex-col gap-8">
      <Link href="/account/orders" className={`${blockLinkClass} gap-1 self-start`}>
        <ChevronLeft aria-hidden className="size-5" />
        All orders
      </Link>

      <div>
        <h1 className={h1Class}>Order #{order.display_id}</h1>
        <p className="mt-2 text-muted-foreground">Placed on {formatOrderDate(order.created_at as string)}</p>
        <div className="mt-4 flex flex-col gap-2 rounded border border-border p-4 sm:flex-row sm:items-center sm:gap-4">
          <StatusBadge tone={status.tone} className="self-start">
            {status.label}
          </StatusBadge>
          <p>{status.detail}</p>
        </div>
      </div>

      <section aria-labelledby="items">
        <h2 id="items" className={h2Class}>
          Items
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {(order.items ?? []).map((item) => (
            <li key={item.id} className="flex gap-4 py-4">
              <div className="flex size-[72px] shrink-0 items-center justify-center rounded bg-surface">
                {item.thumbnail ? (
                  <Image src={item.thumbnail} alt="" width={72} height={72} className="size-[72px] rounded object-contain" />
                ) : (
                  <Package aria-hidden className="size-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-semibold">{item.product_title ?? item.title}</p>
                  {item.variant_title && item.variant_title !== "Default variant" && (
                    <p className="text-muted-foreground">{item.variant_title}</p>
                  )}
                  <p className="text-muted-foreground">Quantity {item.quantity}</p>
                </div>
                <p className="tabular-nums font-semibold sm:text-right">{formatMoney(item.total, cur)}</p>
              </div>
            </li>
          ))}
        </ul>
        <Totals order={order} />
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="delivery" className="rounded border border-border p-4">
          <h2 id="delivery" className="flex items-center gap-2 text-lg font-semibold">
            {collect ? <Store aria-hidden className="size-5" /> : <Truck aria-hidden className="size-5" />}
            {collect ? "Click & Collect" : "Delivery"}
          </h2>
          {collect ? (
            <address className="mt-2 not-italic">
              Tech Nest
              <br />
              {siteConfig.address.line1}, {siteConfig.address.line2}
              <br />
              {siteConfig.address.locality} {siteConfig.address.postcode}
            </address>
          ) : (
            <AddressBlock address={order.shipping_address} />
          )}
          {order.shipping_methods?.[0]?.name && <p className="mt-2 text-muted-foreground">{order.shipping_methods[0].name}</p>}
        </section>

        <section aria-labelledby="help" className="rounded border border-border p-4">
          <h2 id="help" className="flex items-center gap-2 text-lg font-semibold">
            <Phone aria-hidden className="size-5" />
            Help with this order
          </h2>
          <p className="mt-2">Call the shop and tell us order #{order.display_id}.</p>
          <a href={`tel:${siteConfig.phone.e164}`} className={blockLinkClass}>
            Call {siteConfig.phone.display}
          </a>
          <br />
          <Link href="/legal/returns" className={blockLinkClass}>
            Returns and cancellations
          </Link>
        </section>
      </div>
    </div>
  )
}

function Totals({ order }: { order: HttpTypes.StoreOrder }) {
  const cur = order.currency_code
  const rows: [string, number | undefined][] = [
    ["Items", order.item_total],
    ["Delivery", order.shipping_total],
  ]
  if (order.discount_total) rows.push(["Discount", -order.discount_total])
  return (
    <div className="ml-auto mt-4 max-w-sm">
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 tabular-nums">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt>{label}</dt>
          <dd className="text-right">{label === "Delivery" && !value ? "Free" : formatMoney(value, cur)}</dd>
        </div>
      ))}
      <div className="contents text-lg font-bold">
        <dt className="mt-2 border-t border-border pt-2">Total</dt>
        <dd className="mt-2 border-t border-border pt-2 text-right">{formatMoney(order.total, cur)}</dd>
      </div>
    </dl>
    <p className="mt-1 text-right tabular-nums text-muted-foreground">Includes VAT of {formatMoney(order.tax_total, cur)}</p>
    </div>
  )
}

function AddressBlock({ address }: { address?: HttpTypes.StoreOrderAddress | null }) {
  if (!address) return <p className="mt-2 text-muted-foreground">No address on this order.</p>
  return (
    <address className="mt-2 not-italic">
      {[address.first_name, address.last_name].filter(Boolean).join(" ")}
      <br />
      {address.address_1}
      {address.address_2 && (
        <>
          <br />
          {address.address_2}
        </>
      )}
      <br />
      {address.city} {address.postal_code}
    </address>
  )
}
