import { HttpTypes } from "@medusajs/types"
import { listCartPaymentMethods } from "@lib/data/payment"
import Payment from "@modules/checkout/components/payment"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import Review from "@modules/checkout/components/review"

/**
 * Step 3 = E2's payment step, integrated unchanged (apps/storefront/src/modules/
 * checkout/payment* is E2-owned). It reads `?step=payment|review` itself and
 * holds the Place order button (Review -> PaymentButton).
 */
export default async function PaymentSection({ cart }: { cart: HttpTypes.StoreCart }) {
  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? cart.region_id ?? "")

  return (
    <section aria-label="Step 3 of 3: Payment" className="py-6" data-testid="checkout-section-payment">
      {paymentMethods?.length ? (
        <PaymentWrapper cart={cart}>
          <div className="flex flex-col gap-8">
            <Payment cart={cart} availablePaymentMethods={paymentMethods} />
            <Review cart={cart} />
          </div>
        </PaymentWrapper>
      ) : (
        <p role="alert" className="text-destructive">
          Card payments are unavailable right now. Please try again in a few minutes or call the shop.
        </p>
      )}
    </section>
  )
}
