import Image from "next/image"
import Link from "next/link"
import { BatteryCharging, Briefcase, Cable, Clock, Gamepad2, MapPin, Phone, Smartphone, Store, Wrench } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { getOpenStatus, formatTime, siteConfig } from "@/lib/site-config"
import { h2Class } from "@/lib/typography"

const photo = "relative aspect-[4/3] overflow-hidden rounded-lg"

// The same four lines as /repairs, so the home page never promises more than that page does
const REPAIRS = [
  { Icon: Smartphone, label: "Screens" },
  { Icon: BatteryCharging, label: "Batteries" },
  { Icon: Cable, label: "Charging ports" },
  { Icon: Gamepad2, label: "Consoles and laptops" },
]

/**
 * Repairs CTA: repair-bench photo | text with what we fix, secondary button.
 * The photo is a stock picture (Pexels licence: free to use, no attribution
 * needed): the owner wanted a repair scene here, not the shop interior
 * (2026-10-29). Swap in a photo of the shop's own bench when there is one.
 */
export function RepairsCta() {
  return (
    <section aria-labelledby="repairs-heading" className="content-container section">
      <div className="grid gap-6 md:grid-cols-2 md:items-center lg:gap-12">
        <div className={photo}>
          <Image
            src="/images/repair/bench.jpg"
            alt="A phone opened up on a repair mat, with a screwdriver and tweezers beside it"
            fill
            loading="lazy"
            sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2 id="repairs-heading" className={h2Class}>
            Screen broken? Most repairs are done the same day.
          </h2>
          <p className="mt-3 max-w-[60ch] text-muted-foreground">
            Send a request online, we call you back with a price, then bring your device to the
            shop. No obligation.
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2">
            {REPAIRS.map(({ Icon, label }) => (
              <li key={label} className="flex min-h-11 items-center gap-2 font-medium">
                <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                {label}
              </li>
            ))}
          </ul>
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
    <section aria-labelledby="shop-heading" className="bg-surface">
      <div className="content-container section grid gap-6 md:grid-cols-2 md:items-center lg:grid-cols-3 lg:gap-10">
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
          <h2 id="shop-heading" className={h2Class}>
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
            className={buttonVariants({ variant: "secondary", className: "w-full bg-background" })}
          >
            <Phone aria-hidden />
            Call {phone.display}
          </a>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "secondary", className: "w-full bg-background" })}
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
    <section aria-labelledby="trade-heading" className="content-container section">
      <div className="relative isolate overflow-hidden rounded-xl bg-foreground text-white">
        <Image
          src="/images/shop/aisle-accessories.jpg"
          alt=""
          fill
          loading="lazy"
          sizes="(min-width: 1280px) 1216px, 100vw"
          className="-z-10 object-cover opacity-20"
        />
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between lg:p-10">
          <div>
            <h2 id="trade-heading" className={h2Class}>
              Buying for a business?
            </h2>
            <p className="mt-2 max-w-[56ch] text-white/85">
              Open a trade account to buy at trade prices, shown ex-VAT once your account is
              approved. Wholesale is what the shop started with.
            </p>
          </div>
          <Link
            href="/trade"
            className={buttonVariants({
              variant: "secondary",
              className: "w-full shrink-0 border-white bg-transparent text-white hover:bg-white hover:text-foreground md:w-auto",
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
