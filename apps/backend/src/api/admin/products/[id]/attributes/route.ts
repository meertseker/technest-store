import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  inSafetyMarkedCategory,
  PUBLISH_CHECK_FIELDS,
  ProductAttributesValues,
  PublishCheckProduct,
  publishBlocker,
  withDefaults,
} from "../../../../../modules/product-attributes/utils"
import { upsertProductAttributesWorkflow } from "../../../../../workflows/upsert-product-attributes"
import { AdminUpsertProductAttributes } from "./middlewares"

/**
 * The attributes (defaults filled in) plus a read-only publish check for the
 * admin widget: whether the product sits in a charger/power category (so it
 * needs UKCA or CE), and the guard's message if it were published now.
 */
async function loadAttributes(req: AuthenticatedMedusaRequest, productId: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [...PUBLISH_CHECK_FIELDS, "product_attributes.*"],
    filters: { id: productId },
  })
  if (!data.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id: ${productId} was not found`
    )
  }
  const product = data[0] as PublishCheckProduct
  return {
    product_attributes: withDefaults(
      product.product_attributes as Partial<ProductAttributesValues> | null
    ),
    publish_check: {
      needs_safety_marking: inSafetyMarkedCategory(product.categories),
      blocked_reason: publishBlocker({ ...product, status: "published" }),
    },
  }
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await loadAttributes(req, req.params.id))
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpsertProductAttributes>,
  res: MedusaResponse
) {
  await upsertProductAttributesWorkflow(req.scope).run({
    input: { product_id: req.params.id, ...req.validatedBody },
  })
  res.json(await loadAttributes(req, req.params.id))
}
