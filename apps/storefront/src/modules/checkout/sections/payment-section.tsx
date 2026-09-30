import { HttpTypes } from "@medusajs/types"
import PaymentStep from "@modules/checkout/payment/payment-step"
import StepSection from "./step-section"

/**
 * Step 3 = E2's payment step (apps/storefront/src/modules/checkout/payment*).
 * It holds the Place order button. `?step=review` shows the same step.
 */
export default function PaymentSection({
  cart,
  isCollect,
  paymentError,
}: {
  cart: HttpTypes.StoreCart
  isCollect: boolean
  paymentError?: string | null
}) {
  return (
    <StepSection id="payment" number={3} title="Payment" state="open">
      <PaymentStep cart={cart} isCollect={isCollect} paymentError={paymentError} />
    </StepSection>
  )
}
