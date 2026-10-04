import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  ClickCollectEvents,
  COLLECT_ORDER_FIELDS,
  type CollectOrderRow,
  isLockBusyError,
  paymentsOf,
} from "../click-collect"
import { isPickupOrder } from "../email/order-email-data"
import { captureDeliveryOrderWorkflow } from "../../workflows/capture-delivery-order"
import { recordCaptureRetryWorkflow } from "../../workflows/record-capture-retry"
import { CAPTURE_RETRY_AFTER_MS, CAPTURE_RETRY_MAX_ATTEMPTS, CaptureRetryMeta } from "./constants"

export * from "./constants"

/** Longest wait between two attempts. */
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000
/** A card authorisation lasts about 7 days; older orders can't be captured any more. */
const LOOKBACK_MS = 8 * 24 * 60 * 60 * 1000
const PAGE = 200

/** Wait after the nth failed attempt: 15 min, 30 min, 1 h, 2 h, 4 h, then 6 h. */
export const captureRetryBackoffMs = (attempts: number) =>
  Math.min(CAPTURE_RETRY_AFTER_MS * 2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS)

export type CaptureRetryResult = { captured: number; failed: number; gave_up: number }

/**
 * Takes the payment of delivery orders that are still only authorised some
 * time after they were placed: the order.placed capture failed, or the event
 * never arrived. Each order is retried with a growing wait; after the last
 * attempt the shop and the shopper are told (technest.payment.capture_failed)
 * and the order is left for staff. Safe to run at any time and from several
 * runs at once: the capture workflow holds the order's lock and skips
 * payments that are already captured.
 */
export async function retryUncapturedDeliveryOrders(
  container: MedusaContainer,
  now: Date
): Promise<CaptureRetryResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const result: CaptureRetryResult = { captured: 0, failed: 0, gave_up: 0 }

  for (let offset = 0; ; offset += PAGE) {
    const { data } = await query.graph({
      entity: "order",
      fields: COLLECT_ORDER_FIELDS,
      filters: {
        status: { $nin: ["canceled", "draft"] },
        created_at: {
          $gte: new Date(now.getTime() - LOOKBACK_MS),
          $lte: new Date(now.getTime() - CAPTURE_RETRY_AFTER_MS),
        },
      },
      pagination: { skip: offset, take: PAGE, order: { created_at: "ASC" } },
    })
    const orders = data as unknown as CollectOrderRow[]

    for (const order of orders) {
      const meta = order.metadata ?? {}
      if (meta[CaptureRetryMeta.GAVE_UP_AT]) continue
      if (!paymentsOf(order).some((p) => !p.captured_at && !p.canceled_at)) continue
      const attempts = Number(meta[CaptureRetryMeta.ATTEMPTS]) || 0
      const last = Date.parse(String(meta[CaptureRetryMeta.LAST_AT] ?? ""))
      if (attempts && now.getTime() - last < captureRetryBackoffMs(attempts)) continue

      try {
        const optionIds = (order.shipping_methods ?? []).map((m) => m?.shipping_option_id)
        // Click & Collect is captured at the counter, not here.
        if (await isPickupOrder(container, optionIds)) continue
        const { result: run } = await captureDeliveryOrderWorkflow(container).run({
          input: { order_id: order.id, notify_on_failure: false },
        })
        if (run.captured_payment_ids.length) result.captured++
      } catch (e) {
        // Another run or the order.placed capture holds the order: look again next time.
        if (isLockBusyError(e)) continue
        result.failed++
        const gaveUp = attempts + 1 >= CAPTURE_RETRY_MAX_ATTEMPTS
        // IDs and the provider's message only: never card data or customer details.
        logger.error(
          `capture-retry: order ${order.id} attempt ${attempts + 1} of ${CAPTURE_RETRY_MAX_ATTEMPTS} failed: ` +
            (e as Error).message
        )
        try {
          await recordCaptureRetryWorkflow(container).run({
            input: { order_id: order.id, attempts: attempts + 1, at: now.toISOString(), gave_up: gaveUp },
          })
          if (gaveUp) {
            result.gave_up++
            await container
              .resolve(Modules.EVENT_BUS)
              .emit({ name: ClickCollectEvents.CAPTURE_FAILED, data: { order_id: order.id } })
          }
        } catch (recordError) {
          logger.error(
            `capture-retry: order ${order.id} could not be recorded: ${(recordError as Error).message}`
          )
        }
      }
    }
    if (orders.length < PAGE) break
  }
  return result
}
