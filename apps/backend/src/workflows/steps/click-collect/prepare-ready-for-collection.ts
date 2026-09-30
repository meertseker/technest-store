import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  collectStatusOf,
  CollectMeta,
  generateCollectionCode,
  loadPickupOrder,
} from "../../../lib/click-collect"

export type PrepareReadyForCollectionOutput = {
  /** True when the order was already marked ready: nothing to do. */
  already_ready: boolean
  patch: Record<string, unknown>
}

/**
 * Validates that the order is a Click & Collect order that can be marked
 * ready, and builds the metadata to write (code kept if it already exists).
 */
export const prepareReadyForCollectionStep = createStep(
  "technest-prepare-ready-for-collection",
  async ({ order_id }: { order_id: string }, { container }) => {
    const order = await loadPickupOrder(container, order_id)
    if (order.status === "canceled") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Order ${order_id} is cancelled`)
    }
    const meta = order.metadata ?? {}
    const status = collectStatusOf(meta)
    if (status === "collected") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Order ${order_id} was already collected`)
    }
    if (status === "ready") {
      return new StepResponse<PrepareReadyForCollectionOutput>({ already_ready: true, patch: {} })
    }
    const existing = meta[CollectMeta.CODE]
    return new StepResponse<PrepareReadyForCollectionOutput>({
      already_ready: false,
      patch: {
        [CollectMeta.CODE]:
          typeof existing === "string" && existing ? existing : generateCollectionCode(),
        [CollectMeta.READY_AT]: new Date().toISOString(),
      },
    })
  }
)
