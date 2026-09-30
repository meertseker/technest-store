import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { siteConfig } from "@/lib/site-config"

export const metadata: Metadata = {
  title: "About us",
  description:
    "Tech Nest is a phone repair shop and accessories store on Southwark Park Road, Bermondsey. Repairs, phone and computer accessories, a £1 range and trade prices.",
  alternates: { canonical: "/about" },
}

const WHAT_WE_DO = [
  {
    title: "Repairs",
    text: "Phone and device repairs, done in our shop. Tell us the fault, and we give you a price before we start.",
    href: "/repairs",
    cta: "Book a repair",
  },
  {
    title: "Accessories that fit",
    text: "Cases, screen protectors, chargers, cables, audio and gaming accessories. Tell us your device and we only show you what fits it.",
    href: "/store",
    cta: "Shop accessories",
  },
  {
    title: "The £1 range",
    text: "Everyday essentials for £1 each. Add them to any order, or pick them up in the shop.",
    href: "/store",
    cta: "See the range",
  },
  {
    title: "Trade and wholesale",
    text: "Buying for a business? Approved trade accounts see prices without VAT and discounts for larger quantities.",
    href: "/trade",
    cta: "Apply for a trade account",
  },
]

export default function AboutPage() {
  const { address, rating, mapsUrl, hours } = siteConfig
  const openEveryDay = hours.every((h) => h.opens)

  return (
    <div className="content-container py-10 lg:py-14">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] lg:text-4xl">
            About Tech Nest
          </h1>
          <p className="mt-4 max-w-[68ch] text-lg">
            Tech Nest is a phone repair shop and accessories store at {address.line1},{" "}
            {address.line2}, in Bermondsey, London. We fix phones and other devices, and we
            sell mobile and computer accessories to shoppers and to trade customers.
          </p>
          <p className="mt-4 max-w-[68ch] text-lg">
            Customers rate us {rating.value.toFixed(1)} out of 5 on Google, from{" "}
            {rating.count} reviews.{" "}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-4"
            >
              Read our reviews on Google
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </div>
        <div className="lg:col-span-5">
          <Image
            src="/images/shop/interior-wide.jpg"
            alt="Inside the Tech Nest shop: walls of phone cases, chargers and accessories"
            width={2000}
            height={1500}
            sizes="(min-width: 1280px) 500px, (min-width: 1024px) 40vw, 100vw"
            className="h-auto w-full rounded border border-border"
            priority
          />
        </div>
      </div>

      <section aria-labelledby="about-what" className="mt-14">
        <h2 id="about-what" className="text-[22px] font-semibold leading-tight lg:text-[28px]">
          What we do
        </h2>
        <ul className="mt-6 grid gap-6 md:grid-cols-2">
          {WHAT_WE_DO.map((item) => (
            <li key={item.title} className="flex flex-col rounded border border-border bg-surface p-6">
              <h3 className="text-lg font-semibold lg:text-xl">{item.title}</h3>
              <p className="mt-2 flex-1">{item.text}</p>
              <Link href={item.href} className="mt-4 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                {item.cta}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="about-visit" className="mt-14 grid gap-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <Image
            src="/images/shop/aisle-accessories.jpg"
            alt="An aisle in the Tech Nest shop stocked with accessories"
            width={2000}
            height={1500}
            sizes="(min-width: 1280px) 500px, (min-width: 1024px) 40vw, 100vw"
            className="h-auto w-full rounded border border-border"
          />
        </div>
        <div className="lg:col-span-7">
          <h2 id="about-visit" className="text-[22px] font-semibold leading-tight lg:text-[28px]">
            Come and see us
          </h2>
          <p className="mt-3 max-w-[68ch]">
            Order online and collect from the shop for free, or just drop in
            {openEveryDay ? ". We are open seven days a week." : "."}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/contact" className={buttonVariants({ variant: "primary" })}>
              Opening hours and directions
            </Link>
            <Link href="/store" className={buttonVariants({ variant: "secondary" })}>
              Shop online
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
