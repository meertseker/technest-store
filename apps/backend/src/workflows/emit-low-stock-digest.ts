import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { LOW_STOCK_EVENT } from "../lib/low-stock"
import { findLowStockVariantsStep, FindLowStockVariantsInput } from "./steps/find-low-stock-variants"

/**
 * Finds the low variants and emits ONE `technest.inventory.low_stock`
 * `{ items }` event, only when something is low (docs/contracts/emails.md).
 */
export const emitLowStockDigestWorkflow = createWorkflow(
  "emit-low-stock-digest",
  function (input: FindLowStockVariantsInput) {
    const items = findLowStockVariantsStep(input)

    when({ items }, ({ items }) => items.length > 0).then(() => {
      const eventData = transform({ items }, ({ items }) => ({ items }))
      emitEventStep({ eventName: LOW_STOCK_EVENT, data: eventData })
    })

    return new WorkflowResponse({ items })
  }
)
