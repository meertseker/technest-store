import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import ProductAttributesModuleService from "../../modules/product-attributes/service"
import {
  ATTRIBUTE_KEYS,
  ProductAttributesValues,
} from "../../modules/product-attributes/utils"

export type UpsertProductAttributesStepInput = {
  /** The product's current row, if any (read by the workflow before this step). */
  existing?: (Partial<ProductAttributesValues> & { id: string }) | null
  values: Partial<ProductAttributesValues>
}

type Compensation =
  | { created: true; id: string }
  | { created: false; id: string; previous: Partial<ProductAttributesValues> }

/**
 * Creates or updates one product_attributes row (a single mutation). Linking a
 * new row to its product is a separate step in the workflow.
 * Compensation deletes the created row or restores the previous values.
 */
export const upsertProductAttributesStep = createStep(
  "upsert-product-attributes",
  async ({ existing, values }: UpsertProductAttributesStepInput, { container }) => {
    const service: ProductAttributesModuleService = container.resolve(
      PRODUCT_ATTRIBUTES_MODULE
    )

    if (existing?.id) {
      const previous = Object.fromEntries(
        ATTRIBUTE_KEYS.map((key) => [key, existing[key]])
      ) as Partial<ProductAttributesValues>
      const updated = await service.updateProductAttributes({ id: existing.id, ...values })
      return new StepResponse(
        { id: updated.id, created: false },
        { created: false, id: existing.id, previous } as Compensation
      )
    }

    const created = await service.createProductAttributes(values)
    return new StepResponse(
      { id: created.id, created: true },
      { created: true, id: created.id } as Compensation
    )
  },
  async (compensation, { container }) => {
    if (!compensation) return
    const service: ProductAttributesModuleService = container.resolve(
      PRODUCT_ATTRIBUTES_MODULE
    )
    if (compensation.created) {
      await service.deleteProductAttributes(compensation.id)
      return
    }
    await service.updateProductAttributes({
      id: compensation.id,
      ...compensation.previous,
    })
  }
)
