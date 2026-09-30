import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  PUBLISH_CHECK_FIELDS,
  PublishCheckProduct,
  publishBlocker,
} from "../../modules/product-attributes/utils"

/**
 * Loads the products as they are now and fails if any published one breaks a
 * listing rule (safety marking on chargers, no vapes). Used by the product
 * hooks and the attributes workflow; the failure rolls the whole write back.
 */
export async function assertProductsPublishable(
  container: { resolve: (key: string) => any },
  productIds: string[]
) {
  if (!productIds.length) return
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: PUBLISH_CHECK_FIELDS,
    filters: { id: productIds },
  })
  const reasons = (data as PublishCheckProduct[])
    .map(publishBlocker)
    .filter((r): r is string => Boolean(r))
  if (reasons.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, reasons.join(" "))
  }
}

export const assertProductsPublishableStep = createStep(
  "assert-products-publishable",
  async (productIds: string[], { container }) => {
    await assertProductsPublishable(container, productIds)
    return new StepResponse(undefined)
  }
)
