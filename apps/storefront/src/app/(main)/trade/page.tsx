import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Building2, Calculator, ClipboardCheck, Store, Wrench } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import StatusBadge from "@/components/ui/status-badge"
import { siteConfig } from "@/lib/site-config"
import { TRADE_STATUS_COPY, formatUnitPence } from "@/lib/trade/format"
import { blockLinkClass, h1Class, h2Class, leadClass } from "@/lib/typography"
import { getMyTradeApplication } from "@lib/data/trade"

export const metadata: Metadata = {
  title: "Trade accounts",
  description:
    "Buying phone and console accessories for a business? Apply for a Tech Nest trade account: quantity prices shown without VAT, Click & Collect from Southwark Park Road.",
  alternates: { canonical: "/trade" },
}

const WHO = [
  { Icon: Wrench, title: "Repair shops and technicians", text: "Cables, chargers and cases to sell on or fit for customers." },
  { Icon: Building2, title: "Offices and IT teams", text: "Chargers, cables and cases for staff phones and laptops." },
  { Icon: Store, title: "Shops and resellers", text: "Everyday accessories to stock, bought in quantity." },
]

const STEPS = [
  { title: "Create an account", text: "Or sign in if you already have one." },
  { title: "Tell us about your business", text: "Business name and type, and a VAT or Companies House number if you have one." },
  { title: "We check it", text: "A member of the team checks every application and emails you the decision." },
  { title: "See your prices", text: "Signed in, products with trade prices show them ex VAT, and your basket charges them." },
]

// Illustrative only: shows how ex VAT and inc VAT relate at 20%; not a real product price
const EXAMPLE_INC_VAT_PENCE = 750
const EXAMPLE_EX_VAT_PENCE = Math.round(EXAMPLE_INC_VAT_PENCE / 1.2)

export default async function TradePage() {
  // undefined when signed out: the page then shows the plain Apply button
  const application = await getMyTradeApplication()

  return (
    <div>
      <section className="content-container grid gap-8 py-10 lg:grid-cols-12 lg:items-center lg:py-14">
        <div className="lg:col-span-7">
          <h1 className={h1Class}>Trade accounts</h1>
          <p className={`mt-3 ${leadClass}`}>
            Buying accessories for a business? Get lower prices when you buy in quantity, shown without VAT so they match
            your books. Order online or collect from our shop on Southwark Park Road.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {application ? (
              <>
                <StatusBadge tone={TRADE_STATUS_COPY[application.status].tone} className="self-start sm:self-center">
                  Your application: {TRADE_STATUS_COPY[application.status].label}
                </StatusBadge>
                <Link href="/account/trade" className={buttonVariants({ variant: "secondary", className: "w-full sm:w-auto" })}>
                  View your trade account
                </Link>
              </>
            ) : (
              <Link href="/trade/apply" className={buttonVariants({ className: "w-full sm:w-auto" })}>
                Apply for a trade account
              </Link>
            )}
            <a href={`tel:${siteConfig.phone.e164}`} className={`${blockLinkClass} justify-center`}>
              Questions? Call {siteConfig.phone.display}
            </a>
          </div>
        </div>
        <div className="lg:col-span-5">
          <Image
            src="/images/shop/interior-audio.jpg"
            alt="Inside the Tech Nest shop: shelves of headphones, speakers and accessories"
            width={2000}
            height={1500}
            priority
            sizes="(min-width: 1280px) 500px, (min-width: 1024px) 40vw, 100vw"
            className="h-auto w-full rounded border border-border"
          />
        </div>
      </section>

      <section aria-labelledby="who" className="bg-surface py-12 lg:py-20">
        <div className="content-container">
          <h2 id="who" className={h2Class}>
            Who it is for
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {WHO.map(({ Icon, title, text }) => (
              <li key={title} className="rounded border border-border bg-background p-4">
                <Icon aria-hidden className="size-6 text-muted-foreground" />
                <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                <p className="mt-1">{text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-[68ch]">
            Sole traders are welcome. You do not need to be VAT registered or a limited company.
          </p>
        </div>
      </section>

      <section aria-labelledby="prices" className="content-container py-12 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 id="prices" className={`${h2Class} flex items-center gap-2`}>
              <Calculator aria-hidden className="size-7 text-muted-foreground" />
              How trade prices work
            </h2>
            <ul className="mt-4 flex max-w-[68ch] list-disc flex-col gap-2 pl-6">
              <li>
                Trade prices are shown <strong>without VAT</strong>, labelled <strong>ex VAT</strong>. Retail prices on
                the site always include VAT.
              </li>
              <li>
                VAT at 20% is added in your basket, so the total you pay includes VAT.
              </li>
              <li>
                The more you buy, the lower the price each: prices can drop at 10 and at 50 of the same item.
              </li>
              <li>Not every product has a trade price. Where there is none, you pay the normal retail price.</li>
            </ul>
          </div>
          <div className="lg:col-span-5">
            <figure className="rounded border border-border p-4">
              <figcaption className="font-semibold">Reading a trade price (example)</figcaption>
              <table className="mt-3 w-full text-left tabular-nums">
                <tbody>
                  <tr className="border-b border-border">
                    <th scope="row" className="py-2 pr-4 font-normal">
                      Price shown to you
                    </th>
                    <td className="py-2 font-bold">{formatUnitPence(EXAMPLE_EX_VAT_PENCE)} ex VAT</td>
                  </tr>
                  <tr className="border-b border-border">
                    <th scope="row" className="py-2 pr-4 font-normal">
                      VAT at 20%
                    </th>
                    <td className="py-2">{formatUnitPence(EXAMPLE_INC_VAT_PENCE - EXAMPLE_EX_VAT_PENCE)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-2 pr-4 font-normal">
                      You pay in the basket
                    </th>
                    <td className="py-2">{formatUnitPence(EXAMPLE_INC_VAT_PENCE)} inc VAT</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-sm text-muted-foreground" data-small-text>An example only, not the price of a real product.</p>
            </figure>
          </div>
        </div>
      </section>

      <section aria-labelledby="how" className="bg-surface py-12 lg:py-20">
        <div className="content-container">
          <h2 id="how" className={`${h2Class} flex items-center gap-2`}>
            <ClipboardCheck aria-hidden className="size-7 text-muted-foreground" />
            How to apply
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3 rounded border border-border bg-background p-4">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground font-semibold text-background"
                >
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold">{s.title}</span>
                  <span className="mt-1 block">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          {!application && (
            <Link href="/trade/apply" className={buttonVariants({ variant: "secondary", className: "mt-8 w-full sm:w-auto" })}>
              Start your application
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}
