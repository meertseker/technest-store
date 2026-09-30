import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EXPIRE_AFTER_MS, REMINDER_AFTER_MS } from "../lib/click-collect"
import { listClickCollectOrders } from "../lib/click-collect/list"
import {
  expireUncollectedOrderWorkflow,
  remindUncollectedOrderWorkflow,
} from "../workflows/uncollected-orders"

/**
 * Hourly: for Click & Collect orders marked ready and not collected, emit the
 * day-3 reminder once, and cancel (releasing the card authorisation) on day 7.
 * Both workflows re-check the order under a lock and track what they did in
 * metadata, so overlapping or repeated runs do nothing twice.
 */
export default async function clickCollectLifecycleJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { orders } = await listClickCollectOrders(container, {
    status: "ready",
    limit: Number.MAX_SAFE_INTEGER,
    offset: 0,
  })
  const now = Date.now()
  let reminded = 0
  let expired = 0
  for (const order of orders) {
    const age = now - Date.parse(order.ready_at ?? "")
    if (Number.isNaN(age)) continue
    try {
      if (age >= EXPIRE_AFTER_MS) {
        const { result } = await expireUncollectedOrderWorkflow(container).run({
          input: { order_id: order.id },
        })
        if (result.expired) expired++
      } else if (age >= REMINDER_AFTER_MS && !order.reminder_sent_at) {
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
