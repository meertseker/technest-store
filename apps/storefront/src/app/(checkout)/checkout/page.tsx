import { Metadata } from "next"
import { redirect } from "next/navigation"
import { Lock, Phone, RotateCcw } from "lucide-react"
import { retrieveCart } from "@lib/data/cart"
import { CHECKOUT_CART_FIELDS, getBasketView } from "@lib/data/basket"
import { retrieveCustomer } from "@lib/data/customer"
import { formatGbp } from "@lib/basket/money"
import { DELIVERY_LABEL, deliveryKind, type ShippingOptionLike } from "@lib/basket/shipping-options"
import { resolveStep, stepRank } from "@lib/checkout/steps"
import { siteConfig } from "@lib/site-config"
import ContactForm from "@modules/checkout/sections/contact-form"
import DeliveryForm, { type DeliveryDefaults } from "@modules/checkout/sections/delivery-form"
import { DesktopOrderSummary, MobileOrderSummary } from "@modules/checkout/sections/order-summary"
import PaymentSection from "@modules/checkout/sections/payment-section"
import StepSection from "@modules/checkout/sections/step-section"

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
}

// Must render per request: src/middleware.ts sets a fresh CSP nonce on every
// /checkout request, and Next stamps it on this page's scripts at render time.
// A static/cached checkout would serve a stale nonce and Stripe would be blocked.
export const dynamic = "force-dynamic"

const SHOP_ADDRESS = `${siteConfig.name}, ${siteConfig.address.line1}, ${siteConfig.address.line2}, ${siteConfig.address.locality} ${siteConfig.address.postcode}`

/**
 * /checkout (spec 7.5): one page, three sections that collapse to a summary with
 * "Edit". Order summary: collapsed bar on mobile, sticky right column on desktop.
 */
export default async function Checkout(props: { searchParams: Promise<{ step?: string; payment_error?: string }> }) {
  const cart = await retrieveCart(undefined, CHECKOUT_CART_FIELDS)
  if (!cart?.items?.length) redirect("/basket")

  const { step: requested, payment_error } = await props.searchParams
  const step = resolveStep(requested, cart)
  if (requested !== step) redirect(`/checkout?step=${step}`)

  const [customer, view] = await Promise.all([retrieveCustomer(), getBasketView(cart)])
  const rank = stepRank(step)

  const method = cart.shipping_methods?.at(-1)
  const chosen = view.choices.find((c) => c.id === method?.shipping_option_id)
  const chosenKind = chosen?.kind ?? (method ? deliveryKind({ id: "", name: method.name ?? "" } as ShippingOptionLike) : null)
  const addr = cart.shipping_address
  const isCollect = chosenKind === "collect"

  const defaults: DeliveryDefaults = {
    option_id:
      chosen?.id ?? (view.addon_only ? view.choices.find((c) => c.kind === "collect")?.id ?? "" : ""),
    first_name: addr?.first_name ?? customer?.first_name ?? "",
    last_name: addr?.last_name ?? customer?.last_name ?? "",
    phone: addr?.phone ?? customer?.phone ?? "",
    address_1: isCollect ? "" : addr?.address_1 ?? "",
    address_2: isCollect ? "" : addr?.address_2 ?? "",
    city: isCollect ? "" : addr?.city ?? "",
    postal_code: isCollect ? "" : addr?.postal_code ?? "",
  }

  const deliverySummary = method && (
    <>
      <p className="font-semibold text-foreground">
        {chosenKind ? DELIVERY_LABEL[chosenKind] : method.name}
        {" · "}
        {method.amount ? formatGbp(method.total ?? method.amount) : "Free"}
      </p>
      <p>
        {[addr?.first_name, addr?.last_name].filter(Boolean).join(" ")}
        {isCollect ? ` · collecting from ${siteConfig.address.line1}, ${siteConfig.address.line2}` : ""}
      </p>
      {!isCollect && addr && (
        <p>{[addr.address_1, addr.address_2, addr.city, addr.postal_code].filter(Boolean).join(", ")}</p>
      )}
    </>
  )

  return (
    <>
      <MobileOrderSummary cart={cart} deliveryChosen={!!method} />
      <div className="content-container grid grid-cols-1 gap-x-12 pb-12 lg:grid-cols-12 lg:py-10">
        <div className="lg:col-span-7">
          <h1 className="pt-6 text-[28px] font-bold leading-tight tracking-[-0.01em] lg:pt-0 lg:text-4xl">
            Checkout
          </h1>

          <StepSection
            id="contact"
            number={1}
            title="Contact"
            state={step === "contact" ? "open" : "done"}
            editHref="/checkout?step=contact"
            summary={<p className="text-foreground">{cart.email}</p>}
          >
            <ContactForm email={cart.email ?? customer?.email ?? ""} />
          </StepSection>

          <StepSection
            id="delivery"
            number={2}
            title="Delivery"
            state={step === "delivery" ? "open" : rank > 1 ? "done" : "locked"}
            editHref="/checkout?step=delivery"
            summary={deliverySummary}
          >
            <DeliveryForm
              choices={view.choices}
              addonOnly={view.addon_only}
              defaults={defaults}
              shopAddress={SHOP_ADDRESS}
            />
          </StepSection>

          {rank >= 2 ? (
            <PaymentSection cart={cart} isCollect={isCollect} paymentError={payment_error} />
          ) : (
            <StepSection id="payment" number={3} title="Payment" state="locked" />
          )}

          <ul className="mt-8 flex flex-col gap-3 text-muted-foreground" aria-label="Why it's safe to buy">
            <li className="flex items-center gap-2">
              <Lock aria-hidden className="size-5 shrink-0" />
              Secure payment by Stripe. We never see your card number.
            </li>
            <li className="flex items-center gap-2">
              <RotateCcw aria-hidden className="size-5 shrink-0" />
              <span>
                14-day returns.{" "}
                {/* full page load out of checkout so its strict CSP isn't carried to other pages */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/legal/returns" className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4">
                  Returns policy
                </a>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Phone aria-hidden className="size-5 shrink-0" />
              <span>
                Questions? Call the shop on{" "}
                <a href={`tel:${siteConfig.phone.e164}`} className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4">
                  {siteConfig.phone.display}
                </a>
              </span>
            </li>
          </ul>
        </div>
        <DesktopOrderSummary cart={cart} deliveryChosen={!!method} />
      </div>
    </>
  )
}
