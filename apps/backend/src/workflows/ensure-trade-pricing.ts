import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  ensureTradeCustomerGroupStep,
  ensureTradePriceListStep,
} from "./steps/trade-pricing-steps"

/** Idempotently creates the "Trade" customer group and the empty "Trade" price list. */
export const ensureTradePricingWorkflow = createWorkflow(
  "ensure-trade-pricing",
  function () {
    const groupId = ensureTradeCustomerGroupStep()
    const listInput = transform({ groupId }, ({ groupId }) => ({ customer_group_id: groupId }))
    const priceListId = ensureTradePriceListStep(listInput)
    const result = transform({ groupId, priceListId }, ({ groupId, priceListId }) => ({
      customer_group_id: groupId,
      price_list_id: priceListId,
    }))
    return new WorkflowResponse(result)
  }
)
