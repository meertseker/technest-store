import { Metadata } from "next"
import Link from "next/link"
import { getBaseURL } from "@lib/util/env"
import { qrMatrix } from "@/lib/qr/qr"
import { siteConfig } from "@/lib/site-config"
import PrintButton from "@modules/welcome/print-button"

export const metadata: Metadata = {
  title: "Shop online: till poster",
  description: "A printable A4 poster with a QR code to the Tech Nest online shop.",
  robots: { index: false, follow: false },
}

const POINTS = [
  "Accessories that fit your phone",
  "Free Click & Collect from this shop",
  "Book a repair online",
]

/** A4 poster for the till: QR code to the shop's home page. Print from the browser. */
export default function WelcomePosterPage() {
  const shopUrl = new URL("/", getBaseURL()).toString()
  const displayUrl = shopUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const qr = qrMatrix(shopUrl)
  const quiet = 4 // modules of white border the QR spec requires

  return (
    <main id="main" tabIndex={-1} className="min-h-screen bg-surface outline-none print:bg-background">
      <style>{"@page { size: A4 portrait; margin: 12mm; }"}</style>

      <div className="content-container flex flex-wrap items-center justify-between gap-3 py-4 print:hidden">
        <Link href="/" className="inline-flex min-h-11 items-center underline underline-offset-4">
          Back to the shop
        </Link>
        <PrintButton />
      </div>

      <article
        aria-label="Poster"
        className="mx-auto flex w-full max-w-[210mm] flex-col items-center bg-background px-6 py-10 text-center sm:px-12 print:max-w-none print:p-0"
      >
        <p className="text-4xl font-extrabold uppercase tracking-tight text-brand sm:text-6xl">
          Tech Nest
        </p>
        <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.01em] sm:text-5xl">
          Shop online, collect here
        </h1>
        <p className="mt-3 text-lg sm:text-2xl">Scan with your phone camera</p>

        <svg
          role="img"
          aria-label={`QR code linking to ${displayUrl}`}
          viewBox={`${-quiet} ${-quiet} ${qr.size + quiet * 2} ${qr.size + quiet * 2}`}
          className="mt-8 aspect-square w-full max-w-[90mm]"
          shapeRendering="crispEdges"
        >
          <rect x={-quiet} y={-quiet} width={qr.size + quiet * 2} height={qr.size + quiet * 2} className="fill-background" />
          <path d={qr.path} className="fill-foreground" />
        </svg>

        <p className="mt-4 text-2xl font-bold sm:text-4xl">{displayUrl}</p>

        <ul className="mt-8 flex flex-col gap-2 text-lg sm:text-2xl">
          {POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>

        <p className="mt-10 border-t border-border pt-6 text-base sm:text-lg">
          {siteConfig.address.oneLine} · {siteConfig.phone.display}
        </p>
      </article>
    </main>
  )
}
