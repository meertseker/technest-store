import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { reportError } from "./alerting"

/** A card authorisation lapses by itself after about 7 days; older orders hold nothing. */
const LOOKBACK_MS = 8 * 24 * 60 * 60 * 1000
const PAGE = 200

type Row = {
  id: string
  payment_collections?:
    | ({
        payments?: ({ id: string; captured_at?: unknown; canceled_at?: unknown } | null)[] | null
      } | null)[]
    | null
}

export type AuthorisationReleaseResult = { released: number; failed: number }

/**
 * Releases the card hold of orders that are cancelled but whose payment is
 * still authorised. Cancelling an order releases the hold at the time; when
 * the payment provider failed then, the order is already cancelled and
 * nothing else would try again, so the hold would sit on the shopper's card
 * until it lapsed. Each run retries; a release that fails again is logged
 * (ids only) and retried on the next run.
 */
export async function releaseStuckAuthorisations(
  container: MedusaContainer,
  now: Date
): Promise<AuthorisationReleaseResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const payments = container.resolve(Modules.PAYMENT)
  const result: AuthorisationReleaseResult = { released: 0, failed: 0 }

  for (let offset = 0; ; offset += PAGE) {
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "payment_collections.payments.id",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
      ],
      filters: { status: "canceled", created_at: { $gte: new Date(now.getTime() - LOOKBACK_MS) } },
      pagination: { skip: offset, take: PAGE, order: { created_at: "ASC" } },
    })
    const orders = data as unknown as Row[]
    for (const order of orders) {
      const held = (order.payment_collections ?? [])
        .flatMap((pc) => pc?.payments ?? [])
        .filter((p): p is NonNullable<typeof p> => !!p && !p.captured_at && !p.canceled_at)
      for (const payment of held) {
        try {
          await payments.cancelPayment(payment.id)
          result.released++
        } catch (e) {
          result.failed++
          logger.error(
            `authorisation-release: order ${order.id} is cancelled but payment ${payment.id} is still ` +
              `authorised (${(e as Error).message}). It is retried on the next run; if this repeats, ` +
              `release it in the Stripe dashboard.`
          )
          reportError(e, { source: "job:authorisation-release", order_id: order.id, payment_id: payment.id })
        }
      }
    }
    if (orders.length < PAGE) break
  }
  return result
}
