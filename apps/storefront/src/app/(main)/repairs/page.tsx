import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { BatteryCharging, Cable, Clock, Gamepad2, MapPin, PhoneCall, Smartphone, Wrench } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { formatTime, getOpenStatus, siteConfig } from "@/lib/site-config"
import { blockLinkClass, h1Class, h2Class, leadClass } from "@/lib/typography"

export const metadata: Metadata = {
  title: "Phone, tablet and console repairs",
  description: `Phone, tablet, console and laptop repairs at Tech Nest, ${siteConfig.address.oneLine}. Most repairs same day. Send a request online and we call you back with a price.`,
  alternates: { canonical: "/repairs" },
}

// What the shop repairs (same wording as the home page repairs band). No prices:
// the backend has no repair price list, so the price is agreed on the phone.
const REPAIRS = [
  { Icon: Smartphone, title: "Screens", text: "Cracked, black or unresponsive screens on phones and tablets." },
  { Icon: BatteryCharging, title: "Batteries", text: "Batteries that drain fast, swell or shut the device down." },
  { Icon: Cable, title: "Charging ports", text: "Loose connections, or a device that will not charge." },
  { Icon: Gamepad2, title: "Consoles and laptops", text: "Tell us the fault and we will tell you what we can do." },
]

const STEPS = [
  { title: "Send a request", text: "Tell us your device and what is wrong. It takes a minute and costs nothing." },
  { title: "We call you back", text: "We confirm the price and a time. You decide, with no obligation." },
  { title: "Bring it to the shop", text: "Most repairs are done the same day." },
]

export default function RepairsPage() {
  const { address, phone, mapsUrl, hours } = siteConfig
  const status = getOpenStatus(new Date())

  return (
    <div>
      <section className="content-container grid gap-8 py-10 lg:grid-cols-12 lg:items-center lg:py-14">
        <div className="lg:col-span-7">
          <h1 className={h1Class}>Phone, tablet and console repairs</h1>
          <p className={`mt-3 ${leadClass}`}>
            <strong>Most repairs same day</strong>, done in our shop on Southwark Park Road. Send us a request and we
            call you back with a price before anything is booked.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/repairs/book" className={buttonVariants({ className: "w-full sm:w-auto" })}>
              <Wrench aria-hidden />
              Book a repair
            </Link>
            <a href={`tel:${phone.e164}`} className={`${blockLinkClass} justify-center gap-2`}>
              <PhoneCall aria-hidden className="size-5" />
              Or call {phone.display}
            </a>
          </div>
        </div>
        <div className="lg:col-span-5">
          <Image
            src="/images/shop/interior-wide.jpg"
            alt="Inside the Tech Nest shop: aisles of cables, chargers and accessories"
            width={2000}
            height={1500}
            priority
            sizes="(min-width: 1280px) 500px, (min-width: 1024px) 40vw, 100vw"
            className="h-auto w-full rounded border border-border"
          />
        </div>
      </section>

      <section aria-labelledby="what" className="bg-surface py-12 lg:py-20">
        <div className="content-container">
          <h2 id="what" className={h2Class}>
            What we repair
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REPAIRS.map(({ Icon, title, text }) => (
              <li key={title} className="rounded border border-border bg-background p-4">
                <Icon aria-hidden className="size-6 text-muted-foreground" />
                <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                <p className="mt-1">{text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-[68ch]">
            Not sure if we can fix it? Send a request anyway, or call us. We will tell you what we can do.

          </p>
        </div>
      </section>

      <section aria-labelledby="how" className="content-container py-12 lg:py-20">
        <h2 id="how" className={h2Class}>
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded border border-border p-4">
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
        <p className="mt-6 max-w-[68ch]">
          Before you bring your device in, back up your data if you can. Read our{" "}
          <Link href="/legal/repair-terms" className="underline underline-offset-4">
            repair terms
          </Link>{" "}
          for the details.
        </p>
        <Link href="/repairs/book" className={buttonVariants({ variant: "secondary", className: "mt-6 w-full sm:w-auto" })}>
          Send a repair request
        </Link>
      </section>

      <section aria-labelledby="visit" className="bg-surface py-12 lg:py-20">
        <div className="content-container grid gap-8 md:grid-cols-2 md:items-center lg:gap-12">
          <Image
            src="/images/shop/interior-audio.jpg"
            alt="Inside the Tech Nest shop: shelves of headphones, speakers and accessories"
            width={2000}
            height={1500}
            loading="lazy"
            sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
            className="h-auto w-full rounded border border-border"
          />
          <div>
            <h2 id="visit" className={h2Class}>
              Visit the shop
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
        </div>
      </section>
    </div>
  )
}
