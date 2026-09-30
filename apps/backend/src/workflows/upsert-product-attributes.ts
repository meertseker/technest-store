import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ProductAttributesValues } from "../modules/product-attributes/utils"
import { assertProductsPublishableStep } from "./steps/assert-products-publishable"
import { upsertProductAttributesStep } from "./steps/upsert-product-attributes"

export type UpsertProductAttributesWorkflowInput = {
  product_id: string
} & Partial<ProductAttributesValues>

/**
 * Partial upsert of a product's attributes (ADR 0001). A published charger
 * can't lose its safety marking: the guard runs after the write and rolls it back.
 */
export const upsertProductAttributesWorkflow = createWorkflow(
  "upsert-product-attributes",
  function (input: UpsertProductAttributesWorkflowInput) {
    const stepInput = transform({ input }, ({ input }) => {
      const { product_id, ...values } = input
      return { product_id, values }
    })
    const attributes = upsertProductAttributesStep(stepInput)
    const ids = transform({ input }, ({ input }) => [input.product_id])
    assertProductsPublishableStep(ids)
    return new WorkflowResponse(attributes)
  }
)
