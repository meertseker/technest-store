import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { completeCartReleasingHold } from "./cart-completion"

const MINUTE = 60 * 1000

/** A payment session is first looked at this long after it was created. */
export const RECONCILE_AFTER_MS = 15 * MINUTE
/**
 * A session is looked at when its age is inside one of these windows: 15
 * minutes, 2 hours and 24 hours old. The job runs every 10 minutes, so each
 * session is checked about three times in its life and an abandoned basket
 * costs three calls to the payment provider, not one every run.
 */
const WINDOWS_MS = [RECONCILE_AFTER_MS, 2 * 60 * MINUTE, 24 * 60 * MINUTE]
const WINDOW_WIDTH_MS = 10 * MINUTE

type SessionRow = {
  id: string
  payment_collection_id: string
  payment?: { id: string } | null
}

export type PaymentReconcileResult = {
  /** Carts that were paid for but never completed, and are orders now. */
  orders_placed: number
  /** Carts that could no longer become an order: the card hold was released. */
  holds_released: number
  /** Orders that existed without a payment record, authorised now. */
  payments_authorised: number
}

/**
 * Repairs payments whose follow-up was lost. The shopper's card is authorised
 * in the browser; the order is then created by the browser's next call or by
 * Stripe's webhook. When both are lost (tab closed, webhook dropped while the
 * worker was down) a hold with no order is left; when the server dies in the
 * middle of completing, an order with no payment record is left.
 *
 * For each payment session of the right age:
 *  - its cart has no order: complete the cart. The provider is asked whether
 *    the payment is really authorised, so an unpaid basket stays a basket.
 *    A cart that can't become an order any more has its hold released.
 *  - its order has no payment yet: authorise the session, which creates the
 *    payment (the capture-retry job then takes it for delivery orders).
 *
 * Completion holds the cart's lock and returns the existing order when there
 * is one, so this can't create a second order next to the browser or webhook.
 */
export async function reconcilePayments(
  container: MedusaContainer,
  now: Date
): Promise<PaymentReconcileResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const payments = container.resolve(Modules.PAYMENT)
  const result: PaymentReconcileResult = { orders_placed: 0, holds_released: 0, payments_authorised: 0 }

  for (const age of WINDOWS_MS) {
    const { data } = await query.graph({
      entity: "payment_session",
      fields: ["id", "payment_collection_id", "payment.id"],
      filters: {
        created_at: {
          $gt: new Date(now.getTime() - age - WINDOW_WIDTH_MS),
          $lte: new Date(now.getTime() - age),
        },
      },
    })
    for (const session of data as unknown as SessionRow[]) {
      try {
        const { data: carts } = await query.graph({
          entity: "cart_payment_collection",
          fields: ["cart_id"],
          filters: { payment_collection_id: session.payment_collection_id },
        })
        const cartId = (carts[0] as { cart_id?: string } | undefined)?.cart_id
        const hasOrder = cartId
          ? (await query.graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: cartId } })).data
              .length > 0
          : (
              await query.graph({
                entity: "order_payment_collection",
                fields: ["order_id"],
                filters: { payment_collection_id: session.payment_collection_id },
              })
            ).data.length > 0

        if (hasOrder) {
          if (session.payment) continue
          // Throws when the provider doesn't confirm the payment: nothing to repair then.
          const payment = await payments.authorizePaymentSession(session.id, {})
          if (payment) {
            result.payments_authorised++
            logger.warn(`payment-reconcile: authorised payment session ${session.id} of an existing order`)
          }
          continue
        }
        if (!cartId) continue

        const completion = await completeCartReleasingHold(container, cartId)
        if (completion.outcome === "order") {
          result.orders_placed++
          logger.warn(`payment-reconcile: placed order ${completion.order_id} for cart ${cartId}`)
        } else if (completion.outcome === "refused" && completion.payment_released) {
          result.holds_released++
          logger.warn(`payment-reconcile: released the hold of cart ${cartId}: ${completion.error.message}`)
        }
      } catch (e) {
        // Expected for baskets that were never paid. IDs only in logs.
        logger.debug(`payment-reconcile: session ${session.id} left as it is: ${(e as Error).message}`)
      }
    }
  }
  return result
}
