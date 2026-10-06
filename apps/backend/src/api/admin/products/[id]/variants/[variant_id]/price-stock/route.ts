import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateVariantPriceStockWorkflow } from "../../../../../../../workflows/update-variant-price-stock"
import type { AdminPostVariantPriceStock } from "../../middlewares"

/** Price & stock tab: one variant's GBP price and/or stock. See docs/contracts/price-stock.md. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostVariantPriceStock>,
  res: MedusaResponse
) {
  const { result } = await updateVariantPriceStockWorkflow(req.scope).run({
    input: {
      product_id: req.params.id,
      variant_id: req.params.variant_id,
      price_pence: req.validatedBody.price_pence,
      stock: req.validatedBody.stock,
      expected_stock: req.validatedBody.expected_stock,
    },
  })
  res.json(result)
}
