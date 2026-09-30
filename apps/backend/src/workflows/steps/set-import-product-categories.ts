import { IProductModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type SetImportProductCategoriesInput = {
  product_id: string
  category_ids: string[]
}[]

/**
 * Replaces the categories of existing products. Its own step because
 * `updateProductsWorkflow`'s compensation doesn't restore categories; this
 * one puts the previous categories back.
 */
export const setImportProductCategoriesStep = createStep(
  "set-import-product-categories",
  async (input: SetImportProductCategoriesInput, { container }) => {
    if (!input.length) return new StepResponse(undefined, [])
    const products: IProductModuleService = container.resolve(Modules.PRODUCT)

    const before = await products.listProducts(
      { id: input.map((r) => r.product_id) },
      { select: ["id"], relations: ["categories"], take: null }
    )
    const previous = before.map((p) => ({
      product_id: p.id,
      category_ids: (p.categories ?? []).map((c) => c.id),
    }))

    try {
      for (const row of input) {
        await products.updateProducts(row.product_id, { category_ids: row.category_ids })
      }
    } catch (e) {
      // A failed step isn't compensated, so put back what was changed so far.
      await restore(products, previous)
      throw e
    }
    return new StepResponse(undefined, previous)
  },
  async (previous, { container }) => {
    if (!previous?.length) return
    await restore(container.resolve(Modules.PRODUCT), previous)
  }
)

async function restore(
  products: IProductModuleService,
  previous: { product_id: string; category_ids: string[] }[]
) {
  for (const row of previous) {
    await products.updateProducts(row.product_id, { category_ids: row.category_ids })
  }
}
