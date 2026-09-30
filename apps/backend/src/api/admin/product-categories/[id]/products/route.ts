import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
  refetchEntity,
} from "@medusajs/framework/http"
import { LinkMethodRequest } from "@medusajs/framework/types"
import { linkProductsToCategoryWorkflow } from "../../../../../workflows/link-products-to-category"

/**
 * Overrides the core POST /admin/product-categories/:id/products (same path,
 * registered after core) to run the publish guard. The core middlewares still
 * validate the body and build req.queryConfig; the response is the same.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<LinkMethodRequest>,
  res: MedusaResponse
) {
  const { id } = req.params
  await linkProductsToCategoryWorkflow(req.scope).run({
    input: { id, ...req.validatedBody },
  })

  const product_category = await refetchEntity({
    entity: "product_category",
    idOrFilter: id,
    scope: req.scope,
    fields: req.queryConfig.fields,
  })
  res.status(200).json({ product_category })
}
