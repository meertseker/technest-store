import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { withDefaults } from "../../../../../modules/product-attributes/utils"
import { upsertProductAttributesWorkflow } from "../../../../../workflows/upsert-product-attributes"
import { AdminUpsertProductAttributes } from "./middlewares"

async function loadAttributes(req: MedusaRequest, productId: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "product_attributes.*"],
    filters: { id: productId },
  })
  if (!data.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id: ${productId} was not found`
    )
  }
  return withDefaults((data[0] as Record<string, any>).product_attributes)
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ product_attributes: await loadAttributes(req, req.params.id) })
}

export async function POST(
  req: MedusaRequest<AdminUpsertProductAttributes>,
  res: MedusaResponse
) {
  await upsertProductAttributesWorkflow(req.scope).run({
    input: { product_id: req.params.id, ...req.validatedBody },
  })
  res.json({ product_attributes: await loadAttributes(req, req.params.id) })
}
