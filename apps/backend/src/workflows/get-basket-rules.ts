import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { getBasketRulesStep } from "./steps/basket-rules"

/** Basket notice for the storefront (docs/contracts/basket-rules.md). */
export const getBasketRulesWorkflow = createWorkflow(
  "get-basket-rules",
  function (input: { cart_id: string }) {
    const rules = getBasketRulesStep(input)
    return new WorkflowResponse(rules)
  }
)
