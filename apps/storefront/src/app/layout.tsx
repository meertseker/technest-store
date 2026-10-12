import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import "styles/globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

/**
 * Display face for headings and prices (docs/specs/design.md 3, revised in the
 * 2026-10 redesign): a grotesque with the weight of the shop sign. Body and UI
 * text stay in Inter. Swapping it back is this one declaration.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["opsz", "wdth"],
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: {
    default: "Tech Nest | Phone accessories and repairs, Bermondsey",
    template: "%s | Tech Nest",
  },
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-mode="light" className={`${inter.variable} ${display.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-background focus:px-4 focus:py-3"
        >
          Skip to content
        </a>
        {props.children}
      </body>
    </html>
  )
}
