import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import ProductAttributesModuleService from "../../modules/product-attributes/service"
import {
  ATTRIBUTE_KEYS,
  ProductAttributesValues,
} from "../../modules/product-attributes/utils"

export type UpsertProductAttributesStepInput = {
  product_id: string
  values: Partial<ProductAttributesValues>
}

type Compensation =
  | { created: true; product_id: string; id: string }
  | { created: false; id: string; previous: Partial<ProductAttributesValues> }

export const upsertProductAttributesStep = createStep(
  "upsert-product-attributes",
  async ({ product_id, values }: UpsertProductAttributesStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const service: ProductAttributesModuleService = container.resolve(
      PRODUCT_ATTRIBUTES_MODULE
    )

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "product_attributes.*"],
      filters: { id: product_id },
    })
    if (!products.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Product with id: ${product_id} was not found`
      )
    }

    // The link field isn't in the generated Product type until `medusa develop` runs.
    const existing = (products[0] as Record<string, unknown>).product_attributes as
      | (ProductAttributesValues & { id: string })
      | null
      | undefined

    if (existing?.id) {
      const previous = Object.fromEntries(
        ATTRIBUTE_KEYS.map((key) => [key, existing[key]])
      ) as Partial<ProductAttributesValues>
      const updated = await service.updateProductAttributes({ id: existing.id, ...values })
      return new StepResponse(updated, {
        created: false,
        id: existing.id,
        previous,
      } as Compensation)
    }

    const created = await service.createProductAttributes(values)
    const link = container.resolve(ContainerRegistrationKeys.LINK)
    await link.create({
      [Modules.PRODUCT]: { product_id },
      [PRODUCT_ATTRIBUTES_MODULE]: { product_attributes_id: created.id },
    })
    return new StepResponse(created, {
      created: true,
      product_id,
      id: created.id,
    } as Compensation)
  },
  async (compensation, { container }) => {
    if (!compensation) return
    const service: ProductAttributesModuleService = container.resolve(
      PRODUCT_ATTRIBUTES_MODULE
    )
    if (compensation.created) {
      const link = container.resolve(ContainerRegistrationKeys.LINK)
      await link.dismiss({
        [Modules.PRODUCT]: { product_id: compensation.product_id },
        [PRODUCT_ATTRIBUTES_MODULE]: { product_attributes_id: compensation.id },
      })
      await service.deleteProductAttributes(compensation.id)
      return
    }
    await service.updateProductAttributes({
      id: compensation.id,
      ...compensation.previous,
    })
  }
)
