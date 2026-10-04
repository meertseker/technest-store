import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { completeCartReleasingHold } from "./cart-completion"

const MINUTE = 60 * 1000

/** A payment session is first looked at this long after it was created. */
export const RECONCILE_AFTER_MS = 15 * MINUTE
/**
 * A session is looked at when it passes each of these ages: 15 minutes, 2
 * hours and 24 hours. An abandoned basket so costs three calls to the payment
 * provider in its life, not one every run.
 */
const AGES_MS = [RECONCILE_AFTER_MS, 2 * 60 * MINUTE, 24 * 60 * MINUTE]
/** How far back a run looks when it isn't told when the last one was. */
const DEFAULT_SINCE_MS = 10 * MINUTE
/** On the first run after a start, everything of the last day is looked at once. */
export const RECONCILE_CATCH_UP_MS = 25 * 60 * MINUTE

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
 * Every payment session that passed one of the ages above since the last run
 * (`since`) is looked at, so a late or skipped run leaves no gap:
 *  - The provider is asked first whether the payment is really authorised
 *    (authorising the session, under the cart's lock so it can't collide with
 *    a completion in flight). An unpaid basket stops here: no order is
 *    started for it and nothing is reserved.
 *  - Its cart has no order: complete the cart. A cart that can't become an
 *    order any more (sold out, a basket rule) has its hold released.
 *  - Its order had no payment: the authorisation above created it (the
 *    capture-retry job then takes the payment of delivery orders).
 *
 * Completion holds the cart's lock and returns the existing order when there
 * is one, so this can't create a second order next to the browser or webhook.
 */
export async function reconcilePayments(
  container: MedusaContainer,
  now: Date,
  since: Date = new Date(now.getTime() - DEFAULT_SINCE_MS)
): Promise<PaymentReconcileResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const payments = container.resolve(Modules.PAYMENT)
  const locking = container.resolve(Modules.LOCKING)
  const result: PaymentReconcileResult = { orders_placed: 0, holds_released: 0, payments_authorised: 0 }

  const sessions = new Map<string, SessionRow>()
  for (const age of AGES_MS) {
    const { data } = await query.graph({
      entity: "payment_session",
      fields: ["id", "payment_collection_id", "payment.id"],
      filters: {
        created_at: {
          $gt: new Date(since.getTime() - age),
          $lte: new Date(now.getTime() - age),
        },
      },
    })
    for (const session of data as unknown as SessionRow[]) sessions.set(session.id, session)
  }

  const cartOf = async (session: SessionRow) => {
    const { data } = await query.graph({
      entity: "cart_payment_collection",
      fields: ["cart_id"],
      filters: { payment_collection_id: session.payment_collection_id },
    })
    return (data[0] as { cart_id?: string } | undefined)?.cart_id
  }
  const hasOrder = async (session: SessionRow, cartId: string | undefined) => {
    const { data } = cartId
      ? await query.graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: cartId } })
      : await query.graph({
          entity: "order_payment_collection",
          fields: ["order_id"],
          filters: { payment_collection_id: session.payment_collection_id },
        })
    return data.length > 0
  }
  /** Asks the provider; true when the payment is authorised (the payment record exists afterwards). */
  const authorise = async (session: SessionRow) => {
    const [fresh] = await payments.listPaymentSessions({ id: [session.id] }, { relations: ["payment"] })
    if (!fresh) return false
    if (fresh.payment) return true
    // Throws when the provider doesn't confirm the payment (never paid, 3-D Secure still open).
    return Boolean(await payments.authorizePaymentSession(session.id, {}))
  }

  for (const session of sessions.values()) {
    try {
      const cartId = await cartOf(session)
      // The lock completeCartWorkflow and the webhook take: no completion is in flight while we look.
      const state = cartId
        ? await locking.execute(
            cartId,
            async () => {
              const ordered = await hasOrder(session, cartId)
              if (ordered && session.payment) return { ordered, authorised: true, repaired: false }
              return { ordered, authorised: await authorise(session), repaired: ordered }
            },
            { timeout: 5 }
          )
        : await (async () => {
            const ordered = await hasOrder(session, undefined)
            if (!ordered || session.payment) return { ordered, authorised: false, repaired: false }
            return { ordered, authorised: await authorise(session), repaired: true }
          })()

      if (state.ordered) {
        if (state.repaired && state.authorised) {
          result.payments_authorised++
          logger.warn(`payment-reconcile: authorised payment session ${session.id} of an existing order`)
        }
        continue
      }
      if (!cartId || !state.authorised) continue

      // Paid for, no order. The lock is free again: completion takes it itself.
      const completion = await completeCartReleasingHold(container, cartId)
      if (completion.outcome === "order") {
        result.orders_placed++
        logger.warn(`payment-reconcile: placed order ${completion.order_id} for cart ${cartId}`)
      } else if (completion.outcome === "refused" && completion.payment_released) {
        result.holds_released++
        logger.warn(`payment-reconcile: released the hold of cart ${cartId}: ${completion.error.message}`)
      }
    } catch (e) {
      // Expected for baskets that were never paid, and for a cart that is busy. IDs only in logs.
      logger.debug(`payment-reconcile: session ${session.id} left as it is: ${(e as Error).message}`)
    }
  }
  return result
}
