import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import ProductAttributesModuleService from "../../modules/product-attributes/service"
import {
  ATTRIBUTE_KEYS,
  ProductAttributesValues,
} from "../../modules/product-attributes/utils"

export type UpsertImportAttributesInput = {
  product_id: string
  values: Partial<ProductAttributesValues>
}[]

type Compensation = {
  created: { product_id: string; id: string }[]
  updated: { id: string; previous: Partial<ProductAttributesValues> }[]
}

/**
 * Partial upsert of many products' attributes (ADR 0001) in one step.
 * Unlike the single-product attributes workflow it doesn't run the publish
 * guard itself: the import runs it through the product update hook once every
 * write (category, attributes, status) is in place. Compensation restores the
 * previous values and removes rows it created.
 */
export const upsertImportAttributesStep = createStep(
  "upsert-import-attributes",
  async (input: UpsertImportAttributesInput, { container }) => {
    const compensation: Compensation = { created: [], updated: [] }
    const rows = input.filter((r) => Object.keys(r.values).length > 0)
    if (!rows.length) return new StepResponse(undefined, compensation)

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const link = container.resolve(ContainerRegistrationKeys.LINK)
    const service: ProductAttributesModuleService = container.resolve(
      PRODUCT_ATTRIBUTES_MODULE
    )

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "product_attributes.*"],
      filters: { id: rows.map((r) => r.product_id) },
    })
    const existingByProduct = new Map(
      products.map((p) => [
        p.id,
        (p as Record<string, unknown>).product_attributes as
          | (ProductAttributesValues & { id: string })
          | null
          | undefined,
      ])
    )

    const toUpdate = rows.filter((r) => existingByProduct.get(r.product_id)?.id)
    const toCreate = rows.filter((r) => !existingByProduct.get(r.product_id)?.id)

    try {
      if (toUpdate.length) {
        const updates = toUpdate.map((row) => {
          const existing = existingByProduct.get(row.product_id)!
          const previous = Object.fromEntries(
            ATTRIBUTE_KEYS.map((key) => [key, existing[key]])
          ) as Partial<ProductAttributesValues>
          return { id: existing.id, values: row.values, previous }
        })
        await service.updateProductAttributes(
          updates.map((u) => ({ id: u.id, ...u.values }))
        )
        compensation.updated.push(...updates.map(({ id, previous }) => ({ id, previous })))
      }
      if (toCreate.length) {
        const created = await service.createProductAttributes(
          toCreate.map((row) => row.values)
        )
        compensation.created.push(
          ...created.map((c, i) => ({ product_id: toCreate[i].product_id, id: c.id }))
        )
        await link.create(
          compensation.created.map((row) => ({
            [Modules.PRODUCT]: { product_id: row.product_id },
            [PRODUCT_ATTRIBUTES_MODULE]: { product_attributes_id: row.id },
          }))
        )
      }
    } catch (e) {
      // A failed step isn't compensated, so undo the rows written so far here.
      await undo(container, compensation)
      throw e
    }
    return new StepResponse(undefined, compensation)
  },
  async (compensation, { container }) => {
    if (compensation) await undo(container, compensation)
  }
)

async function undo(container: { resolve: (key: string) => any }, c: Compensation) {
  const service: ProductAttributesModuleService = container.resolve(PRODUCT_ATTRIBUTES_MODULE)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  if (c.created.length) {
    await link.dismiss(
      c.created.map((row) => ({
        [Modules.PRODUCT]: { product_id: row.product_id },
        [PRODUCT_ATTRIBUTES_MODULE]: { product_attributes_id: row.id },
      }))
    )
    await service.deleteProductAttributes(c.created.map((row) => row.id))
  }
  if (c.updated.length) {
    await service.updateProductAttributes(
      c.updated.map((row) => ({ id: row.id, ...row.previous }))
    )
  }
}
