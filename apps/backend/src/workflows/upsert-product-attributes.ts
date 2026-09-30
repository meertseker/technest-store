import { Modules } from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createRemoteLinkStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { PRODUCT_ATTRIBUTES_MODULE } from "../modules/product-attributes"
import { ProductAttributesValues } from "../modules/product-attributes/utils"
import { assertProductsPublishableStep } from "./steps/assert-products-publishable"
import { upsertProductAttributesStep } from "./steps/upsert-product-attributes"

export type UpsertProductAttributesWorkflowInput = {
  product_id: string
} & Partial<ProductAttributesValues>

/**
 * Partial upsert of a product's attributes (ADR 0001).
 *
 * lock -> read product + row (404 if the product is missing) -> upsert row ->
 * link a new row to the product -> publish guard -> unlock.
 * A published charger can't lose its safety marking: the guard runs after the
 * write, and its failure compensates the link and the upsert.
 * Locked per product so two concurrent saves can't both create a row for the
 * one-to-one link.
 */
export const upsertProductAttributesWorkflow = createWorkflow(
  "upsert-product-attributes",
  function (input: UpsertProductAttributesWorkflowInput) {
    const lockKey = transform({ input }, ({ input }) => `product-attributes:${input.product_id}`)
    acquireLockStep({ key: lockKey, timeout: 5, ttl: 30 })

    const { data: products } = useQueryGraphStep({
      entity: "product",
      fields: ["id", "product_attributes.*"],
      filters: { id: input.product_id },
      options: { throwIfKeyNotFound: true },
    })

    const stepInput = transform({ input, products }, ({ input, products }) => {
      const { product_id: _productId, ...values } = input
      // The link field isn't in the generated Product type until `medusa develop` runs.
      const existing = (products[0] as Record<string, any> | undefined)?.product_attributes
      return { existing: existing?.id ? existing : null, values }
    })
    const upserted = upsertProductAttributesStep(stepInput)

    when({ upserted }, ({ upserted }) => upserted.created).then(() => {
      const linkData = transform({ input, upserted }, ({ input, upserted }) => [
        {
          [Modules.PRODUCT]: { product_id: input.product_id },
          [PRODUCT_ATTRIBUTES_MODULE]: { product_attributes_id: upserted.id },
        },
      ])
      createRemoteLinkStep(linkData)
    })

    const ids = transform({ input }, ({ input }) => [input.product_id])
    assertProductsPublishableStep(ids)
    releaseLockStep({ key: lockKey })

    return new WorkflowResponse(upserted)
  }
)
