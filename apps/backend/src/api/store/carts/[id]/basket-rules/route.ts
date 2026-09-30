import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getBasketRulesWorkflow } from "../../../../../workflows/get-basket-rules"

/**
 * GET /store/carts/:id/basket-rules -> { basket_rules: BasketRules }
 * Contract: docs/contracts/basket-rules.md.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await getBasketRulesWorkflow(req.scope).run({
    input: { cart_id: req.params.id },
  })
  res.json({ basket_rules: result })
}
