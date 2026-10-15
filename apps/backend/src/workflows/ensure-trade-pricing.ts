import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { TRADE_LOCK_OPTIONS, TRADE_PRICING_SETUP_LOCK_KEY } from "./steps/trade-locks"
import {
  ensureTradeCustomerGroupStep,
  ensureTradePriceListStep,
} from "./steps/trade-pricing-steps"

/** Idempotently creates the "Trade" customer group and the empty "Trade" price list. */
export const ensureTradePricingWorkflow = createWorkflow(
  "ensure-trade-pricing",
  function () {
    acquireLockStep({ key: TRADE_PRICING_SETUP_LOCK_KEY, ...TRADE_LOCK_OPTIONS })
    const groupId = ensureTradeCustomerGroupStep()
    const listInput = transform({ groupId }, ({ groupId }) => ({ customer_group_id: groupId }))
    const priceListId = ensureTradePriceListStep(listInput)
    const result = transform({ groupId, priceListId }, ({ groupId, priceListId }) => ({
      customer_group_id: groupId,
      price_list_id: priceListId,
    }))
    releaseLockStep({ key: TRADE_PRICING_SETUP_LOCK_KEY })
    return new WorkflowResponse(result)
  }
)
