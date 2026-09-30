import { Metadata } from "next"

import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getBaseURL } from "@lib/util/env"
import { JsonLd } from "@/lib/seo/json-ld"
import { buildLocalBusinessJsonLd } from "@/lib/seo/local-business"
import { siteConfig } from "@/lib/site-config"
import CookieBanner from "@modules/consent/cookie-banner"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: { children: React.ReactNode }) {
  const customer = await retrieveCustomer()
  const cart = await retrieveCart()

  return (
    <>
      <JsonLd data={buildLocalBusinessJsonLd(siteConfig, getBaseURL())} />
      <CookieBanner />
      <Nav />
      {customer && cart && (
        <CartMismatchBanner customer={customer} cart={cart} />
      )}

      {/* "Added to basket" toasts; the free-delivery progress lives in the basket drawer */}
      <Toaster />
      <main id="main" tabIndex={-1} className="relative outline-none">
        {props.children}
      </main>
      <Footer />
    </>
  )
}
