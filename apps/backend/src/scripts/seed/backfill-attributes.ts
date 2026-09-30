import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  PLATFORMS,
  ProductAttributesValues,
  SAFETY_MARKINGS,
} from "../../modules/product-attributes/utils"
import { upsertProductAttributesWorkflow } from "../../workflows/upsert-product-attributes"

type Json = Record<string, unknown> | null | undefined

/**
 * Before ADR 0001 landed, the seed wrote attributes to product.metadata and
 * reorder_level to variant.metadata. Reads them back into typed values.
 */
export function attributesFromMetadata(
  metadata: Json,
  variantMetadata: Json[]
): Partial<ProductAttributesValues> {
  const m = metadata ?? {}
  const values: Partial<ProductAttributesValues> = {}
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined)
  const num = (v: unknown) => {
    const n = typeof v === "string" ? Number(v) : v
    return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined
  }

  if (text(m.connector_a)) values.connector_a = text(m.connector_a)!
  if (text(m.connector_b)) values.connector_b = text(m.connector_b)!
  if (num(m.wattage) !== undefined) values.wattage = num(m.wattage)!
  if (num(m.cable_length_m) !== undefined) values.cable_length_m = num(m.cable_length_m)!
  if (num(m.warranty_months) !== undefined) {
    values.warranty_months = Math.round(num(m.warranty_months)!)
  }
  if (m.is_addon_item === true || m.is_addon_item === "true") values.is_addon_item = true
  if (SAFETY_MARKINGS.includes(m.safety_marking as any)) {
    values.safety_marking = m.safety_marking as ProductAttributesValues["safety_marking"]
  }
  if (Array.isArray(m.platform)) {
    values.platform = m.platform.filter((p): p is ProductAttributesValues["platform"][number] =>
      PLATFORMS.includes(p as any)
    )
  }
  const reorder = variantMetadata
    .map((vm) => num(vm?.reorder_level))
    .find((n) => n !== undefined)
  if (reorder !== undefined) values.reorder_level = Math.round(reorder)
  return values
}

/** Copies metadata attributes into the module for products that have no row yet. */
export async function backfillProductAttributes(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "metadata", "variants.metadata", "product_attributes.id"],
  })

  let count = 0
  for (const product of products as Record<string, any>[]) {
    if (product.product_attributes?.id) continue
    const values = attributesFromMetadata(
      product.metadata,
      (product.variants ?? []).map((v: Record<string, any> | null) => v?.metadata)
    )
    if (!Object.keys(values).length) continue
    await upsertProductAttributesWorkflow(container).run({
      input: { product_id: product.id, ...values },
    })
    count++
  }
  logger.info(`Backfilled product attributes for ${count} products.`)
}
