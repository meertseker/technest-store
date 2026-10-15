import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  collectStatusOf,
  CollectMeta,
  collectionDeadlineOf,
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

export type PrepareUncollectedInput = { order_id: string }

function readyAgeMs(metadata: Record<string, unknown> | null | undefined, now: number): number | null {
  const readyAt = Date.parse(String(metadata?.[CollectMeta.READY_AT] ?? ""))
  return Number.isNaN(readyAt) ? null : now - readyAt
}

/** Day-3 reminder: due once for a ready, uncollected, uncancelled order. */
export const prepareCollectionReminderStep = createStep(
  "prepare-collection-reminder",
  async ({ order_id }: PrepareUncollectedInput, { container }) => {
    const now = Date.now()
    const order = await loadPickupOrder(container, order_id)
    const meta = order.metadata ?? {}
    const age = readyAgeMs(meta, now)
    if (
      order.status === "canceled" ||
      collectStatusOf(meta) !== "ready" ||
      meta[CollectMeta.REMINDER_SENT_AT] ||
      age === null ||
      age < REMINDER_AFTER_MS ||
      now > (collectionDeadlineOf(order) ?? Infinity)
    ) {
      return new StepResponse(NOT_DUE)
    }
    return new StepResponse<PrepareUncollectedOutput>({
      due: true,
      patch: { [CollectMeta.REMINDER_SENT_AT]: new Date(now).toISOString() },
    })
  }
)

/**
 * Expiry: due for an uncollected, uncancelled order (ready or never marked
 * ready) once its collection deadline has passed and its payment is still
 * only authorised. The deadline is tied to the card authorisation
 * (lib/click-collect/deadline.ts): after it the payment can't be taken. A captured payment is never auto-cancelled (that
 * would refund the customer without a human deciding): it is logged instead.
 */
export const prepareCollectionExpiryStep = createStep(
  "prepare-collection-expiry",
  async ({ order_id }: PrepareUncollectedInput, { container }) => {
    const now = Date.now()
    const order = await loadPickupOrder(container, order_id)
    const meta = order.metadata ?? {}
    const deadline = collectionDeadlineOf(order)
    const status = collectStatusOf(meta)
    if (order.status === "canceled" || status === "collected" || deadline === null || now <= deadline) {
      return new StepResponse(NOT_DUE)
    }
    if (paymentsOf(order).some((p) => p.captured_at)) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `Click & Collect: order ${order_id} is past its collection deadline but its payment ` +
            `is already captured, so it was not cancelled automatically. Review it manually.`
        )
      return new StepResponse(NOT_DUE)
    }
    if (status !== "ready") {
      // Never marked ready: the shopper wasn't late, so the cancellation email must not say so.
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(`Click & Collect: order ${order_id} was never marked ready and is cancelled at its deadline.`)
      return new StepResponse<PrepareUncollectedOutput>({
        due: true,
        patch: { [CollectMeta.CANCEL_STARTED]: new Date(now).toISOString() },
      })
    }
    return new StepResponse<PrepareUncollectedOutput>({
      due: true,
      patch: {
        [CollectMeta.EXPIRED_AT]: new Date(now).toISOString(),
        // Marks the cancel as ours before Stripe is called (see record-hold-released).
        [CollectMeta.CANCEL_STARTED]: new Date(now).toISOString(),
      },
    })
  }
)
