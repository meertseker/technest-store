import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Clock, Mail, MapPin, Phone } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { formatTime, getOpenStatus, siteConfig } from "@/lib/site-config"

export const metadata: Metadata = {
  title: "Contact us",
  description: `Call Tech Nest on ${siteConfig.phone.display} or visit our shop at ${siteConfig.address.oneLine}. Opening hours, directions and help with orders.`,
  alternates: { canonical: "/contact" },
}

const HELP_LINKS = [
  { href: "/legal/delivery", label: "Delivery and Click & Collect" },
  { href: "/legal/returns", label: "Returns and cancellations" },
  { href: "/repairs", label: "Book a repair" },
  { href: "/trade", label: "Trade accounts" },
]

export default function ContactPage() {
  const { address, phone, mapsUrl, hours, email } = siteConfig
  // Rendered per request (the (main) layout is dynamic), so this is the current London time
  const status = getOpenStatus(new Date())

  return (
    <div className="content-container py-10 lg:py-14">
      <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] lg:text-4xl">
        Contact us
      </h1>
      <p className="mt-3 max-w-[68ch] text-lg">
        The quickest way to reach us is to call or pop into the shop. We can help with orders,
        returns, repairs and finding the right accessory for your device.
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-7">
          <section aria-labelledby="contact-call">
            <h2 id="contact-call" className="flex items-center gap-2 text-[22px] font-semibold lg:text-[28px]">
              <Phone aria-hidden className="size-6 text-muted-foreground" /> Call us
            </h2>
            <a
              href={`tel:${phone.e164}`}
              className={buttonVariants({ variant: "primary", className: "mt-3 w-full sm:w-auto" })}
            >
              Call {phone.display}
            </a>
          </section>

          {email && (
            <section aria-labelledby="contact-email">
              <h2 id="contact-email" className="flex items-center gap-2 text-[22px] font-semibold lg:text-[28px]">
                <Mail aria-hidden className="size-6 text-muted-foreground" /> Email us
              </h2>
              <a href={`mailto:${email}`} className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                {email}
              </a>
            </section>
          )}

          <section aria-labelledby="contact-visit">
            <h2 id="contact-visit" className="flex items-center gap-2 text-[22px] font-semibold lg:text-[28px]">
              <MapPin aria-hidden className="size-6 text-muted-foreground" /> Visit the shop
            </h2>
            <address className="mt-3 not-italic">
              Tech Nest
              <br />
              {address.line1}, {address.line2}
              <br />
              {address.locality} {address.postcode}
            </address>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "secondary", className: "mt-4 w-full sm:w-auto" })}
            >
              Get directions on Google Maps
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </section>

          <section aria-labelledby="contact-hours">
            <h2 id="contact-hours" className="flex items-center gap-2 text-[22px] font-semibold lg:text-[28px]">
              <Clock aria-hidden className="size-6 text-muted-foreground" /> Opening hours
            </h2>
            <p className="mt-3 font-semibold">{status.label}</p>
            <table className="mt-2 w-full max-w-sm">
              <caption className="sr-only">Opening hours</caption>
              <tbody>
                {hours.map((h) => (
                  <tr
                    key={h.day}
                    className={h.day === status.today.day ? "font-semibold" : undefined}
                    aria-current={h.day === status.today.day ? "date" : undefined}
                  >
                    <th scope="row" className="py-1 pr-6 text-left font-[inherit]">
                      {h.day}
                    </th>
                    <td className="py-1 tabular-nums">
                      {h.opens && h.closes ? `${formatTime(h.opens)}–${formatTime(h.closes)}` : "Closed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="contact-help">
            <h2 id="contact-help" className="text-[22px] font-semibold lg:text-[28px]">
              Help with an order
            </h2>
            <ul className="mt-2">
              {HELP_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-11 items-center underline underline-offset-4">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="lg:col-span-5">
          <Image
            src="/images/shop/shopfront.jpg"
            alt="The Tech Nest shopfront on Southwark Park Road, with its red sign"
            width={2000}
            height={1413}
            sizes="(min-width: 1280px) 500px, (min-width: 1024px) 40vw, 100vw"
            className="h-auto w-full rounded border border-border"
          />
        </div>
      </div>
    </div>
  )
}
