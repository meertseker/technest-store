import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getProductTradeTiersWorkflow } from "../../../../../workflows/get-product-trade-tiers"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await getProductTradeTiersWorkflow(req.scope).run({
    input: {
      customer_id: req.auth_context.actor_id,
      product_id: req.params.id,
      sales_channel_ids: req.publishable_key_context?.sales_channel_ids ?? [],
    },
  })
  res.json(result)
}
