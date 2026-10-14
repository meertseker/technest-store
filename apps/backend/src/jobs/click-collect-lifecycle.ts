import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reportAlert, reportError } from "../lib/alerting"
import { runEmail } from "../lib/email/run-email"
import { CollectMeta, collectionDeadlineOf, REMINDER_AFTER_MS } from "../lib/click-collect"
import { listUncollectedOrders } from "../lib/click-collect/list"
import { collectOutsideBoardWorkflow } from "../workflows/collect-outside-board"
import { handedOverFulfillment } from "../workflows/steps/click-collect/prepare-outside-board"
import {
  expireUncollectedOrderWorkflow,
  remindUncollectedOrderWorkflow,
} from "../workflows/uncollected-orders"

/**
 * Hourly: for Click & Collect orders not collected yet, first take the
 * payment of any order handed over with Medusa's own order-page buttons
 * (fulfilment marked delivered or shipped) instead of the board, mark it
 * collected and tell the shop once. Otherwise emit the day-3
 * reminder once (ready orders), and cancel (releasing the card authorisation)
 * once the collection deadline has passed, whether or not the order was ever
 * marked ready: the authorisation can't be captured after it.
 * Both workflows re-check the order under its lock and record what they did
 * in metadata, so overlapping or repeated runs never act twice.
 */
export default async function clickCollectLifecycleJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  let orders: Awaited<ReturnType<typeof listUncollectedOrders>>
  try {
    orders = await listUncollectedOrders(container)
  } catch (e) {
    // Don't throw from a scheduled job: log and try again next hour.
    logger.error(`click-collect-lifecycle: listing uncollected orders failed: ${(e as Error).message}`)
    reportError(e, { source: "job:click-collect-lifecycle" })
    return
  }
  let reminded = 0
  let expired = 0
  let outside = 0
  for (const order of orders) {
    const meta = order.metadata ?? {}
    const now = Date.now()
    const deadline = collectionDeadlineOf(order)
    const age = now - Date.parse(String(meta[CollectMeta.READY_AT] ?? ""))
    try {
      if (handedOverFulfillment(order.fulfillments)) {
        // The goods have left: take the payment whatever the deadline says.
        const { result } = await collectOutsideBoardWorkflow(container).run({ input: { order_id: order.id } })
        if (result.collected && result.fulfillment_id) {
          outside++
          reportAlert(
            `Click & Collect order ${order.id} was handed over from the order page, not the board; payment taken by the lifecycle job`,
            { source: "job:click-collect-lifecycle", order_id: order.id, fulfillment_id: result.fulfillment_id },
            `collected-outside-board:${order.id}`
          )
          await runEmail(container, {
            template: "shop-payment-notice",
            recipient: "shop",
            resource_id: result.fulfillment_id,
            resource_type: "fulfillment",
            trigger_type: "technest.order.collected",
            ids: [order.id],
          })
        }
        continue
      }
      if (deadline === null) continue
      if (now > deadline) {
        const { result } = await expireUncollectedOrderWorkflow(container).run({
          input: { order_id: order.id },
        })
        if (result.expired) expired++
      } else if (age >= REMINDER_AFTER_MS && !meta[CollectMeta.REMINDER_SENT_AT]) {
        const { result } = await remindUncollectedOrderWorkflow(container).run({
          input: { order_id: order.id },
        })
        if (result.reminded) reminded++
      }
    } catch (e) {
      // One bad order must not stop the others. IDs only in logs.
      logger.error(`click-collect-lifecycle: order ${order.id} failed: ${(e as Error).message}`)
      reportError(e, { source: "job:click-collect-lifecycle", order_id: order.id })
    }
  }
  if (reminded || expired || outside) {
    logger.info(
      `click-collect-lifecycle: ${reminded} reminded, ${expired} cancelled, ${outside} collected outside the board`
    )
  }
}

export const config = {
  name: "click-collect-lifecycle",
  schedule: "0 * * * *",
}
