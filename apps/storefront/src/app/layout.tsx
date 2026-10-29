import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { Inter } from "next/font/google"
import "styles/globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

// One typeface everywhere: the owner asked for a plain, clean face (2026-10-29),
// so the Bricolage Grotesque display face from the 2026-10 redesign is gone and
// `font-display` resolves to Inter in tailwind.config.js.

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: {
    default: "Tech Nest | Phone accessories and repairs, Bermondsey",
    template: "%s | Tech Nest",
  },
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-mode="light" className={inter.variable}>
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
