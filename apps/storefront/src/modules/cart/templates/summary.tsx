"use client"

import { Heading } from "@modules/common/components/ui"
import { buttonVariants } from "@/components/ui/button"

import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import DiscountCode from "@modules/checkout/components/discount-code"
import { HttpTypes } from "@medusajs/types"

type SummaryProps = {
  cart: HttpTypes.StoreCart
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

const Summary = ({ cart }: SummaryProps) => {
  const step = getCheckoutStep(cart)

  return (
    <div className="flex flex-col gap-y-4">
      <Heading level="h2" className="text-[2rem] leading-[2.75rem]">
        Summary
      </Heading>
      <DiscountCode cart={cart} />
      <Divider />
      <CartTotals totals={cart} />
      {/* Full page load on purpose: /checkout's CSP only applies to a document
          the server sends, so no client-side navigation into checkout */}
      <a
        href={"/checkout?step=" + step}
        className={buttonVariants({ className: "w-full" })}
        data-testid="checkout-button"
      >
        Go to checkout
      </a>
    </div>
  )
}

export default Summary
