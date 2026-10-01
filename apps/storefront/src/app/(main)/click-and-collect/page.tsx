import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Clock, MapPin, PhoneCall } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { formatTime, getOpenStatus, siteConfig } from "@/lib/site-config"
import { blockLinkClass, h1Class, h2Class, leadClass, linkClass } from "@/lib/typography"

export const metadata: Metadata = {
  title: "Free Click & Collect",
  description: `Order online and collect free from Tech Nest, ${siteConfig.address.oneLine}. We email you when your order is ready, and your card is only charged when you collect.`,
  alternates: { canonical: "/click-and-collect" },
}

// The same facts as /legal/delivery ("How Click & Collect works"), in plain steps
const STEPS = [
  { title: "Choose Collect from shop", text: "Pick it at checkout. It is free, with no minimum order." },
  { title: "Wait for our email", text: "We email you when your order is ready. Please wait for it before you come in." },
  { title: "Collect and pay", text: "Bring the email. Your card is only charged when you collect." },
]

const FACTS = [
  {
    title: "What to bring",
    text: "The “ready to collect” email, on your phone is fine. We may ask for the collection code in it and for your name.",
  },
  {
    title: "How long we keep it",
    text: "7 days. We send a reminder after 3 days. If it is not collected in 7 days we cancel the order and the reserved amount is released.",
  },
  {
    title: "When you pay",
    text: "At checkout the amount is only reserved on your card. We take the payment when you collect.",
  },
  {
    title: "£1 items",
    text: "£1 add-on items can't be delivered on their own, but you can always collect them from the shop.",
  },
]

export default function ClickAndCollectPage() {
  const { address, phone, mapsUrl, hours } = siteConfig
  const status = getOpenStatus(new Date())

  return (
    <div>
      <section className="content-container grid gap-8 py-10 lg:grid-cols-12 lg:items-center lg:py-14">
        <div className="lg:col-span-7">
          <h1 className={h1Class}>Free Click &amp; Collect</h1>
          <p className={`mt-3 ${leadClass}`}>
            Order online and collect from our shop on Southwark Park Road. It costs nothing, and you
            only pay when you pick your order up.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/search" className={buttonVariants({ className: "w-full sm:w-auto" })}>
              Start shopping
            </Link>
            <a href={`tel:${phone.e164}`} className={`${blockLinkClass} justify-center gap-2`}>
              <PhoneCall aria-hidden className="size-5" />
              Or call {phone.display}
            </a>
          </div>
        </div>
        <div className="lg:col-span-5">
          <Image
            src="/images/shop/shopfront.jpg"
            alt="The Tech Nest shopfront on Southwark Park Road, with its red sign"
            width={2000}
            height={1413}
            priority
            sizes="(min-width: 1280px) 500px, (min-width: 1024px) 40vw, 100vw"
            className="h-auto w-full rounded border border-border"
          />
        </div>
      </section>

      <section aria-labelledby="how" className="bg-surface py-12 lg:py-20">
        <div className="content-container">
          <h2 id="how" className={h2Class}>
            How it works
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
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
        </div>
      </section>

      <section aria-labelledby="know" className="content-container py-12 lg:py-20">
        <h2 id="know" className={h2Class}>
          Good to know
        </h2>
        <dl className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {FACTS.map((f) => (
            <div key={f.title}>
              <dt className="text-lg font-semibold">{f.title}</dt>
              <dd className="mt-1 max-w-[68ch]">{f.text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 max-w-[68ch]">
          Prefer delivery? See{" "}
          <Link href="/legal/delivery" className={linkClass}>
            delivery prices and times
          </Link>
          . Changed your mind? See{" "}
          <Link href="/legal/returns" className={linkClass}>
            returns and cancellations
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="visit" className="bg-surface py-12 lg:py-20">
        <div className="content-container">
          <h2 id="visit" className={h2Class}>
            Where to collect
          </h2>
          <p className="mt-3 flex items-start gap-2">
            <MapPin aria-hidden className="mt-1 size-5 shrink-0 text-muted-foreground" />
            <span>
              Tech Nest, {address.line1}, {address.line2}, {address.locality} {address.postcode}
            </span>
          </p>
          <p className="mt-2 flex items-start gap-2">
            <Clock aria-hidden className="mt-1 size-5 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-semibold">{status.label}</span>
              <span className="block text-muted-foreground">
                {hours
                  .filter((h) => h.opens && h.closes)
                  .map((h) => `${h.day.slice(0, 3)} ${formatTime(h.opens!)}–${formatTime(h.closes!)}`)
                  .join(" · ")}
              </span>
            </span>
          </p>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "secondary", className: "mt-6 w-full sm:w-auto" })}
          >
            Get directions
            <span className="sr-only"> on Google Maps (opens in a new tab)</span>
          </a>
        </div>
      </section>
    </div>
  )
}
