import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

/**
 * POST /store/payment-collections/:id/payment-sessions accepts a free-form
 * `data` object that Medusa passes to the payment provider and stores on the
 * session. The storefront never needs it, and client-controlled values there
 * (e.g. a foreign PaymentIntent id) are a risk (ADR 0002), so refuse it.
 */
export function rejectClientPaymentData(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const data = (req.body as { data?: unknown } | undefined)?.data
  const isEmptyObject =
    data !== null && typeof data === "object" && !Array.isArray(data) && Object.keys(data).length === 0
  if (data !== undefined && !isEmptyObject) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Payment session data is set by the server; do not send `data`"
    )
  }
  next()
}
