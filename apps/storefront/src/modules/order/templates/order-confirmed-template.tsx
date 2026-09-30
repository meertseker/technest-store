import Image from "next/image"
import { CalendarCheck, Clock, MapPin, Truck } from "lucide-react"
import { HttpTypes } from "@medusajs/types"
import { buttonVariants } from "@/components/ui/button"
import { siteConfig, formatTime, getOpenStatus } from "@lib/site-config"
import {
  expectedDeliveryDate,
  formatDeliveryDate,
  orderDeliveryKind,
} from "@lib/order/delivery-estimate"
import { SummaryBody } from "@modules/checkout/sections/order-summary"
import CreateAccountOffer from "@modules/order/components/create-account-offer"

/** Today's opening hours in London time: "9am to 8pm" or null when closed */
export function todaysHours(now: Date) {
  const { today } = getOpenStatus(now)
  return today.opens && today.closes ? `${formatTime(today.opens)} to ${formatTime(today.closes)}` : null
}

/**
 * Order confirmation (spec 7.6): H1, order number, email; then Click & Collect
 * (shop photo, address, today's hours, map link, "we'll email you") or the
 * expected delivery date; then the summary and the account offer.
 */
export default function OrderConfirmedTemplate({
  order,
  isGuest,
  now = new Date(),
}: {
  order: HttpTypes.StoreOrder
  isGuest: boolean
  now?: Date
}) {
  const kind = orderDeliveryKind(order)
  const placedAt = order.created_at ? new Date(order.created_at) : now
  const expected = expectedDeliveryDate(placedAt, kind)
  const hours = todaysHours(now)
  const addr = order.shipping_address

  return (
    <div className="content-container py-8 lg:py-12" data-testid="order-complete-container">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] lg:text-4xl">
            Thanks, your order is placed
          </h1>
          <p className="text-lg">
            Order number <strong className="font-semibold tabular-nums" data-testid="order-number">#{order.display_id}</strong>
          </p>
          {order.email && (
            <p className="text-muted-foreground">
              We&apos;ve emailed your confirmation to <strong className="font-semibold text-foreground">{order.email}</strong>.
            </p>
          )}
        </header>

        {kind === "collect" ? (
          <section
            aria-labelledby="collect-title"
            className="grid overflow-hidden rounded border border-border md:grid-cols-2"
            data-testid="collect-details"
          >
            <Image
              src="/images/shop/shopfront.jpg"
              alt="The red Tech Nest shopfront on Southwark Park Road"
              width={800}
              height={600}
              sizes="(min-width: 768px) 384px, 100vw"
              className="h-full max-h-72 w-full object-cover md:max-h-none"
            />
            <div className="flex flex-col gap-3 p-4 md:p-6">
              <h2 id="collect-title" className="text-[22px] font-semibold leading-tight">
                Collect from our shop
              </h2>
              <p className="flex gap-2">
                <MapPin aria-hidden className="mt-1 size-5 shrink-0" />
                <span>
                  {siteConfig.name}
                  <br />
                  {siteConfig.address.line1}, {siteConfig.address.line2}
                  <br />
                  {siteConfig.address.locality} {siteConfig.address.postcode}
                </span>
              </p>
              <p className="flex gap-2">
                <Clock aria-hidden className="mt-1 size-5 shrink-0" />
                <span data-testid="todays-hours">{hours ? `Open today ${hours}` : "Closed today"}</span>
              </p>
              <p className="font-semibold">We&apos;ll email you when it&apos;s ready.</p>
              <p className="text-muted-foreground">Bring your order number when you collect.</p>
              <a
                href={siteConfig.mapsUrl}
                className={buttonVariants({ variant: "secondary", size: "md", className: "mt-auto w-full md:w-auto" })}
              >
                <MapPin aria-hidden />
                Open in Google Maps
              </a>
            </div>
          </section>
        ) : (
          <section
            aria-labelledby="delivery-title"
            className="flex flex-col gap-3 rounded border border-border p-4 md:p-6"
            data-testid="delivery-details"
          >
            <h2 id="delivery-title" className="flex items-center gap-2 text-[22px] font-semibold leading-tight">
              <Truck aria-hidden className="size-6" />
              {kind === "next-day" ? "Next-day delivery" : "Standard delivery"}
            </h2>
            {expected && (
              <p className="flex items-center gap-2 text-lg">
                <CalendarCheck aria-hidden className="size-5 shrink-0" />
                <span>
                  Expected by <strong className="font-semibold" data-testid="expected-date">{formatDeliveryDate(expected)}</strong>
                </span>
              </p>
            )}
            {addr && (
              <p className="text-muted-foreground">
                To {[addr.first_name, addr.last_name].filter(Boolean).join(" ")},{" "}
                {[addr.address_1, addr.address_2, addr.city, addr.postal_code].filter(Boolean).join(", ")}
              </p>
            )}
            <p className="text-muted-foreground">We&apos;ll email you a tracking link when it&apos;s on its way.</p>
          </section>
        )}

        <section aria-labelledby="summary-title" className="rounded border border-border bg-surface p-4 md:p-6">
          <h2 id="summary-title" className="mb-4 text-[22px] font-semibold leading-tight">
            Order summary
          </h2>
          <SummaryBody items={order.items ?? undefined} totals={order} deliveryChosen />
        </section>

        {isGuest && order.email && (
          <CreateAccountOffer
            email={order.email}
            firstName={addr?.first_name ?? ""}
            lastName={addr?.last_name ?? ""}
            phone={addr?.phone ?? ""}
          />
        )}
      </div>
    </div>
  )
}
