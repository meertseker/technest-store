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

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: { children: React.ReactNode }) {
  // Only needed for the optional banner below: a backend failure here must not
  // take the whole page down (pages that need the basket handle it themselves).
  const [customer, cart] = await Promise.all([
    retrieveCustomer().catch(() => null),
    retrieveCart().catch(() => null),
  ])

  return (
    <>
      <JsonLd data={buildLocalBusinessJsonLd(siteConfig, getBaseURL())} />
      <CookieBanner />
      <Nav />
      {customer && cart && (
        <CartMismatchBanner customer={customer} cart={cart} />
      )}

      <main id="main" tabIndex={-1} className="relative outline-none">
        {props.children}
      </main>
      <Footer />
    </>
  )
}
