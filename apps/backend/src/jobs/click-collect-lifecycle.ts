import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CollectMeta, collectionDeadlineOf, REMINDER_AFTER_MS } from "../lib/click-collect"
import { listUncollectedOrders } from "../lib/click-collect/list"
import {
  expireUncollectedOrderWorkflow,
  remindUncollectedOrderWorkflow,
} from "../workflows/uncollected-orders"

/**
 * Hourly: for Click & Collect orders not collected yet, emit the day-3
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
    return
  }
  let reminded = 0
  let expired = 0
  for (const order of orders) {
    const meta = order.metadata ?? {}
    const now = Date.now()
    const deadline = collectionDeadlineOf(order)
    if (deadline === null) continue
    const age = now - Date.parse(String(meta[CollectMeta.READY_AT] ?? ""))
    try {
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
    }
  }
  if (reminded || expired) {
    logger.info(`click-collect-lifecycle: ${reminded} reminded, ${expired} cancelled`)
  }
}

export const config = {
  name: "click-collect-lifecycle",
  schedule: "0 * * * *",
}
