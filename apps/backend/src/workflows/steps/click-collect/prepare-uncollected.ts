import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  collectStatusOf,
  CollectMeta,
  EXPIRE_AFTER_MS,
  loadPickupOrder,
  paymentsOf,
  REMINDER_AFTER_MS,
} from "../../../lib/click-collect"

export type PrepareUncollectedOutput = {
  /** True when the action (reminder or expiry) is due now. */
  due: boolean
  patch: Record<string, unknown>
}

const NOT_DUE: PrepareUncollectedOutput = { due: false, patch: {} }

function readyAgeMs(metadata: Record<string, unknown> | null | undefined): number | null {
  const readyAt = Date.parse(String(metadata?.[CollectMeta.READY_AT] ?? ""))
  return Number.isNaN(readyAt) ? null : Date.now() - readyAt
}

/** Day-3 reminder: due once for a ready, uncollected, uncancelled order. */
export const prepareCollectionReminderStep = createStep(
  "prepare-collection-reminder",
  async ({ order_id }: { order_id: string }, { container }) => {
    const order = await loadPickupOrder(container, order_id)
    const meta = order.metadata ?? {}
    const age = readyAgeMs(meta)
    if (
      order.status === "canceled" ||
      collectStatusOf(meta) !== "ready" ||
      meta[CollectMeta.REMINDER_SENT_AT] ||
      age === null ||
      age < REMINDER_AFTER_MS ||
      age >= EXPIRE_AFTER_MS
    ) {
      return new StepResponse(NOT_DUE)
    }
    return new StepResponse<PrepareUncollectedOutput>({
      due: true,
      patch: { [CollectMeta.REMINDER_SENT_AT]: new Date().toISOString() },
    })
  }
)

/**
 * Day-7 expiry: due for a ready, uncollected, uncancelled order whose payment
 * is still only authorised. A captured payment is never auto-cancelled (that
 * would refund the customer without a human deciding): it is logged instead.
 */
export const prepareCollectionExpiryStep = createStep(
  "prepare-collection-expiry",
  async ({ order_id }: { order_id: string }, { container }) => {
    const order = await loadPickupOrder(container, order_id)
    const meta = order.metadata ?? {}
    const age = readyAgeMs(meta)
    if (
      order.status === "canceled" ||
      collectStatusOf(meta) !== "ready" ||
      age === null ||
      age < EXPIRE_AFTER_MS
    ) {
      return new StepResponse(NOT_DUE)
    }
    if (paymentsOf(order).some((p) => p.captured_at)) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `Click & Collect: order ${order_id} is uncollected after 7 days but its payment ` +
            `is already captured, so it was not cancelled automatically. Review it manually.`
        )
      return new StepResponse(NOT_DUE)
    }
    return new StepResponse<PrepareUncollectedOutput>({
      due: true,
      patch: { [CollectMeta.EXPIRED_AT]: new Date().toISOString() },
    })
  }
)
