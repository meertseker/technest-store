import Image from "next/image"
import Link from "next/link"
import { Briefcase, Clock, MapPin, Phone, Store, Wrench } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { getOpenStatus, formatTime, siteConfig } from "@/lib/site-config"
import { sectionTitle } from "../product-section"

const photo = "relative aspect-[4/3] overflow-hidden rounded border border-border"

/** Repairs CTA: surface band, interior photo | text, secondary button */
export function RepairsCta() {
  return (
    <section aria-labelledby="repairs-heading" className="bg-surface">
      <div className="content-container grid gap-6 py-12 md:grid-cols-2 md:items-center lg:gap-12 lg:py-20">
        <div className={photo}>
          <Image
            src="/images/shop/interior-wide.jpg"
            alt="Inside the Tech Nest shop: aisles of cables, chargers and accessories"
            fill
            loading="lazy"
            sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2 id="repairs-heading" className={sectionTitle}>
            Screen broken? Most repairs same day
          </h2>
          <p className="mt-3 max-w-[68ch]">
            Screens, batteries and charging ports for phones, tablets, consoles and laptops. Book
            online, then bring your device to the shop.
          </p>
          <Link
            href="/repairs"
            className={buttonVariants({ variant: "secondary", className: "mt-6 w-full sm:w-auto" })}
          >
            <Wrench aria-hidden />
            Book a repair
          </Link>
        </div>
      </div>
    </section>
  )
}

/**
 * Shop strip: shopfront photo, address, today's hours (London time, per
 * request), Click & Collect, Maps link and a Call button. No static map image
 * yet (it would need a maps API key); the Maps link covers directions.
 */
export function ShopStrip({ now }: { now: Date }) {
  const { address, phone, mapsUrl } = siteConfig
  const status = getOpenStatus(now)
  const today = status.today
  return (
    <section aria-labelledby="shop-heading" className="content-container py-12 lg:py-20">
      <div className="grid gap-6 md:grid-cols-2 md:items-center lg:grid-cols-3 lg:gap-10">
        <div className={photo}>
          <Image
            src="/images/shop/shopfront.jpg"
            alt="The Tech Nest shopfront on Southwark Park Road, with its red sign"
            fill
            loading="lazy"
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2 id="shop-heading" className={sectionTitle}>
            Visit the shop
          </h2>
          <address className="mt-3 flex gap-2 not-italic">
            <MapPin aria-hidden className="mt-1 size-5 shrink-0 text-muted-foreground" />
            <span>
              {address.line1}, {address.line2}
              <br />
              {address.locality} {address.postcode}
            </span>
          </address>
          <p className="mt-3 flex gap-2">
            <Clock aria-hidden className="mt-1 size-5 shrink-0 text-muted-foreground" />
            <span>
              <strong className="font-semibold">{status.label}</strong>
              <br />
              <span className="tabular-nums">
                Today ({today.day}):{" "}
                {today.opens && today.closes
                  ? `${formatTime(today.opens)}–${formatTime(today.closes)}`
                  : "Closed"}
              </span>
            </span>
          </p>
          <p className="mt-3 flex gap-2">
            <Store aria-hidden className="mt-1 size-5 shrink-0 text-muted-foreground" />
            <span>Free Click &amp; Collect: order online, pick up here.</span>
          </p>
        </div>
        <div className="flex flex-col gap-3 md:col-span-2 md:flex-row lg:col-span-1 lg:flex-col">
          <a
            href={`tel:${phone.e164}`}
            className={buttonVariants({ variant: "secondary", className: "w-full" })}
          >
            <Phone aria-hidden />
            Call {phone.display}
          </a>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "secondary", className: "w-full" })}
          >
            <MapPin aria-hidden />
            Open in Google Maps
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center underline underline-offset-4"
          >
            All opening hours
          </Link>
        </div>
      </div>
    </section>
  )
}

/** Trade banner, full width, with a secondary button */
export function TradeBanner() {
  return (
    <section aria-labelledby="trade-heading" className="content-container pb-12 lg:pb-20">
      <div className="relative isolate overflow-hidden rounded bg-foreground text-white">
        <Image
          src="/images/shop/aisle-accessories.jpg"
          alt=""
          fill
          loading="lazy"
          sizes="(min-width: 1280px) 1216px, 100vw"
          className="-z-10 object-cover opacity-25"
        />
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between lg:p-10">
          <div>
            <h2 id="trade-heading" className={sectionTitle}>
              Buying for a business?
            </h2>
            <p className="mt-2 max-w-[60ch]">
              Open a trade account to buy at trade prices, shown ex-VAT once your account is
              approved.
            </p>
          </div>
          <Link
            href="/trade"
            className={buttonVariants({
              variant: "secondary",
              className: "w-full shrink-0 border-white md:w-auto",
            })}
          >
            <Briefcase aria-hidden />
            Apply for a trade account
          </Link>
        </div>
      </div>
    </section>
  )
}
