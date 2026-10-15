import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reportAlert, reportError } from "../lib/alerting"
import { runEmail } from "../lib/email/run-email"
import { CollectMeta, collectionDeadlineOf, REMINDER_AFTER_MS } from "../lib/click-collect"
import { listUncollectedOrders } from "../lib/click-collect/list"
import { collectOutsideBoardWorkflow } from "../workflows/collect-outside-board"
import { handOverOf } from "../workflows/steps/click-collect/prepare-outside-board"
import { recordPaymentNoticeWorkflow } from "../workflows/record-payment-notice"
import {
  expireUncollectedOrderWorkflow,
  remindUncollectedOrderWorkflow,
} from "../workflows/uncollected-orders"

type JobOrder = Awaited<ReturnType<typeof listUncollectedOrders>>[number]
type Logger = { error: (msg: string) => void; info: (msg: string) => void }

/**
 * Hourly: for Click & Collect orders not collected yet, first take the
 * payment of any order whose goods were all handed over with Medusa's own
 * order-page buttons (fulfilments marked delivered or shipped) instead of the
 * board, mark it collected and tell the shop once. An order only partly
 * handed over that way is not charged: staff are alerted once and it stays on
 * the board. Otherwise emit the day-3 reminder once (ready orders), and
 * cancel (releasing the card authorisation) once the collection deadline has
 * passed, whether or not the order was ever marked ready: the authorisation
 * can't be captured after it.
 * The workflows re-check the order under its lock and record what they did
 * in metadata, so overlapping or repeated runs never act twice. A failure is
 * logged every hour but reported once per order and action.
 */
export default async function clickCollectLifecycleJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  let orders: JobOrder[]
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
    const handOver = handOverOf(order.items, order.fulfillments)

    if (handOver?.complete) {
      // The goods have left: take the payment whatever the deadline says. No
      // reminder or cancellation after this: Medusa refuses to cancel an order
      // with live fulfilments, and the customer already has the goods.
      try {
        if (await collectHandedOver(container, order.id)) outside++
      } catch (e) {
        await reportOnce(container, logger, order, "collect_outside_board", e)
      }
      continue
    }
    if (handOver && !meta[CollectMeta.PARTLY_HANDED_OVER]) {
      try {
        await recordPaymentNoticeWorkflow(container).run({
          input: { order_id: order.id, patch: { [CollectMeta.PARTLY_HANDED_OVER]: { at: new Date().toISOString() } } },
        })
        reportAlert(
          `Click & Collect order ${order.id} was partly handed over from the order page; not charged, still on the board. Press Collected when the customer has everything, or cancel the fulfilment`,
          { source: "job:click-collect-lifecycle", order_id: order.id, fulfillment_id: handOver.fulfillment_id },
          `partly-handed-over:${order.id}`
        )
      } catch (e) {
        await reportOnce(container, logger, order, "partly_handed_over", e)
      }
    }

    if (deadline === null) continue
    if (now > deadline) {
      try {
        const { result } = await expireUncollectedOrderWorkflow(container).run({ input: { order_id: order.id } })
        if (result.expired) expired++
      } catch (e) {
        await reportOnce(container, logger, order, "expire", e)
      }
    } else if (age >= REMINDER_AFTER_MS && !meta[CollectMeta.REMINDER_SENT_AT]) {
      try {
        const { result } = await remindUncollectedOrderWorkflow(container).run({ input: { order_id: order.id } })
        if (result.reminded) reminded++
      } catch (e) {
        await reportOnce(container, logger, order, "remind", e)
      }
    }
  }
  if (reminded || expired || outside) {
    logger.info(
      `click-collect-lifecycle: ${reminded} reminded, ${expired} cancelled, ${outside} collected outside the board`
    )
  }
}

/** Takes the payment of an order handed over outside the board; tells the shop once. */
async function collectHandedOver(container: MedusaContainer, orderId: string): Promise<boolean> {
  const { result } = await collectOutsideBoardWorkflow(container).run({ input: { order_id: orderId } })
  if (!result.collected || !result.fulfillment_id) return false
  reportAlert(
    `Click & Collect order ${orderId} was handed over from the order page, not the board; payment taken by the lifecycle job`,
    { source: "job:click-collect-lifecycle", order_id: orderId, fulfillment_id: result.fulfillment_id },
    `collected-outside-board:${orderId}`
  )
  await runEmail(container, {
    template: "shop-payment-notice",
    recipient: "shop",
    resource_id: result.fulfillment_id,
    resource_type: "fulfillment",
    trigger_type: "technest.order.collected",
    ids: [orderId],
  })
  return true
}

/**
 * One bad order must not stop the others. Logged every run (ids only);
 * reported to a person once per order and action, recorded in metadata, so a
 * payment that can never be taken doesn't page someone every hour.
 */
async function reportOnce(container: MedusaContainer, logger: Logger, order: JobOrder, action: string, e: unknown) {
  logger.error(`click-collect-lifecycle: order ${order.id} ${action} failed: ${(e as Error).message}`)
  const failed = ((order.metadata ?? {})[CollectMeta.JOB_FAILED] ?? {}) as Record<string, unknown>
  if (failed[action]) return
  reportError(e, { source: "job:click-collect-lifecycle", order_id: order.id, action })
  try {
    await recordPaymentNoticeWorkflow(container).run({
      input: { order_id: order.id, patch: { [CollectMeta.JOB_FAILED]: { ...failed, [action]: new Date().toISOString() } } },
    })
  } catch (inner) {
    logger.error(`click-collect-lifecycle: order ${order.id}: recording the failure failed: ${(inner as Error).message}`)
  }
}

export const config = {
  name: "click-collect-lifecycle",
  schedule: "0 * * * *",
}
