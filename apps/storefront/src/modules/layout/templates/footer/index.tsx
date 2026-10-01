import Link from "next/link"
import { MapPin, Phone } from "lucide-react"
import { listCategories } from "@lib/data/categories"
import { buildShopMenu } from "@/lib/layout/menu"
import { formatTime, getOpenStatus, siteConfig } from "@/lib/site-config"

const HELP = [
  { href: "/legal/delivery", label: "Delivery" },
  { href: "/legal/returns", label: "Returns" },
  { href: "/click-and-collect", label: "Click & Collect" },
  { href: "/contact", label: "Contact us" },
  { href: "/legal/accessibility", label: "Accessibility statement" },
]

const LEGAL = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/delivery", label: "Delivery" },
  { href: "/legal/returns", label: "Returns" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/accessibility", label: "Accessibility" },
  { href: "/legal/weee", label: "Recycling (WEEE)" },
  { href: "/legal/repair-terms", label: "Repair terms" },
]

/** Named in words, so no logo is the only cue (and no third-party artwork to keep current) */
const PAYMENT_METHODS = ["Visa", "Mastercard", "Apple Pay", "Google Pay", "Klarna"]

const linkClass = "inline-flex min-h-11 items-center hover:underline"

export default async function Footer() {
  // The footer must still render when the backend is down
  const categories = await listCategories({ fields: "id,name,handle,rank,parent_category_id" })
    .then((all) => buildShopMenu(all).slice(0, 8))
    .catch(() => [])
  const status = getOpenStatus(new Date())
  const { address, phone, mapsUrl, hours } = siteConfig

  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="content-container grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
        <section aria-labelledby="footer-shop">
          <h2 id="footer-shop" className="text-lg font-semibold">
            Shop
          </h2>
          <ul className="mt-3">
            {categories.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className={linkClass}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="footer-visit">
          <h2 id="footer-visit" className="text-lg font-semibold">
            Visit us
          </h2>
          <address className="mt-3 not-italic">
            {address.line1}, {address.line2}
            <br />
            {address.locality} {address.postcode}
          </address>
          <p className="mt-2 font-semibold">{status.label}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4">
            {hours.map((h) => (
              <div key={h.day} className="contents">
                <dt>{h.day}</dt>
                <dd className="tabular-nums">
                  {h.opens && h.closes
                    ? `${formatTime(h.opens)}–${formatTime(h.closes)}`
                    : "Closed"}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex flex-col">
            <a href={`tel:${phone.e164}`} className={`${linkClass} gap-2`}>
              <Phone aria-hidden className="size-5" /> {phone.display}
            </a>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClass} gap-2`}
            >
              <MapPin aria-hidden className="size-5" /> Open in Google Maps
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </section>

        <section aria-labelledby="footer-help">
          <h2 id="footer-help" className="text-lg font-semibold">
            Help
          </h2>
          <ul className="mt-3">
            {HELP.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="footer-more">
          <h2 id="footer-more" className="text-lg font-semibold">
            Repairs and trade
          </h2>
          <ul className="mt-3">
            <li>
              <Link href="/repairs" className={linkClass}>
                Book a repair
              </Link>
            </li>
            <li>
              <Link href="/trade" className={linkClass}>
                Trade accounts
              </Link>
            </li>
            <li>
              <Link href="/about" className={linkClass}>
                About us
              </Link>
            </li>
          </ul>
        </section>
      </div>

      <div className="border-t border-border">
        <div className="content-container flex flex-wrap items-center gap-x-4 gap-y-2 pt-6">
          <p className="font-semibold">Secure payment by Stripe. We accept</p>
          <ul aria-label="Ways to pay" className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((m) => (
              <li
                key={m}
                data-small-text
                className="rounded border border-border bg-background px-2 py-1 text-sm font-semibold"
              >
                {m}
              </li>
            ))}
          </ul>
        </div>
        <div className="content-container flex flex-col gap-3 py-6 text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {siteConfig.legalName ?? siteConfig.name}
            {siteConfig.vatNumber ? ` · VAT ${siteConfig.vatNumber}` : ""}
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-4">
              {LEGAL.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  )
}
