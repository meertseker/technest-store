import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  assertStoreProductVisibleStep,
  assertTradeCustomerStep,
  listProductTradeTiersStep,
} from "./steps/trade-tier-steps"

export type GetProductTradeTiersInput = {
  customer_id: string
  product_id: string
  /** Sales channels of the request's publishable key. */
  sales_channel_ids: string[]
}

/**
 * Read-only: trade tier prices for one product, for approved trade accounts only.
 * The permission check lives here (not in the route) so every caller gets it.
 */
export const getProductTradeTiersWorkflow = createWorkflow(
  "get-product-trade-tiers",
  function (input: GetProductTradeTiersInput) {
    const customer = transform({ input }, ({ input }) => ({ customer_id: input.customer_id }))
    assertTradeCustomerStep(customer)
    assertStoreProductVisibleStep(input)
    const tiers = listProductTradeTiersStep(input)
    return new WorkflowResponse(tiers)
  }
)
