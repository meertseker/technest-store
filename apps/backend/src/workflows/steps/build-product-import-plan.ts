import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import ProductDeviceLink from "../../links/product-device"
import {
  buildImportPlan,
  ExistingVariant,
  ImportCategory,
  ImportPlan,
} from "../../lib/product-import/plan"
import { readImportRows } from "../../lib/product-import/rows"
import { SafetyMarking } from "../../modules/product-attributes/utils"

/** The shop's only stock location (brief: "Tech Nest – Southwark Park Rd"). */
export const IMPORT_LOCATION_NAME = "Tech Nest – Southwark Park Rd"

export type ImportDefaults = {
  location_id: string
  sales_channel_id: string
  shipping_profile_id: string
}

export type BuildProductImportPlanOutput = {
  plan: ImportPlan
  defaults: ImportDefaults
}

type Query = {
  graph: (config: Record<string, unknown>) => Promise<{ data: any[] }>
}

export async function loadDefaults(query: Query): Promise<ImportDefaults> {
  const [{ data: locations }, { data: stores }, { data: profiles }] = await Promise.all([
    query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
      filters: { name: IMPORT_LOCATION_NAME },
    }),
    query.graph({ entity: "store", fields: ["id", "default_sales_channel_id"] }),
    query.graph({ entity: "shipping_profile", fields: ["id", "type"] }),
  ])
  const location_id = locations[0]?.id
  const sales_channel_id = stores[0]?.default_sales_channel_id
  const shipping_profile_id = (profiles.find((p) => p.type === "default") ?? profiles[0])?.id
  if (!location_id || !sales_channel_id || !shipping_profile_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `The shop isn't set up for imports yet: it needs the stock location "${IMPORT_LOCATION_NAME}", a default sales channel and a shipping profile.`
    )
  }
  return { location_id, sales_channel_id, shipping_profile_id }
}

async function loadCategories(query: Query): Promise<ImportCategory[]> {
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "name", "parent_category_id"],
  })
  const byId = new Map(data.map((c) => [c.id as string, c]))
  const chainOf = (id: string | null, depth = 0): ImportCategory["chain"] => {
    const c = id ? byId.get(id) : undefined
    if (!c || depth > 10) return null
    return {
      handle: c.handle,
      name: c.name,
      parent_category: chainOf(c.parent_category_id, depth + 1),
    }
  }
  return data.map((c) => ({
    id: c.id,
    handle: c.handle,
    name: c.name,
    chain: chainOf(c.id),
  }))
}

async function loadExistingVariants(
  query: Query,
  skus: string[],
  locationId: string
): Promise<Map<string, ExistingVariant>> {
  const result = new Map<string, ExistingVariant>()
  if (!skus.length) return result

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "sku",
      "manage_inventory",
      "product.id",
      "product.title",
      "product.handle",
      "product.status",
      "product.categories.id",
      "product.tags.value",
      "product.product_attributes.safety_marking",
      "prices.id",
      "prices.amount",
      "prices.currency_code",
      "prices.rules_count",
      "prices.price_list_id",
      "inventory_items.inventory_item_id",
      "inventory_items.inventory.location_levels.location_id",
    ],
    filters: { sku: skus },
  })

  const productIds = [...new Set(variants.map((v) => v.product?.id).filter(Boolean))]
  if (!productIds.length) return result
  // Counted in their own query: "product.variants" loaded from a variant
  // filtered by SKU only holds the variants that matched.
  const [{ data: links }, { data: products }] = await Promise.all([
    query.graph({
      entity: ProductDeviceLink.entryPoint,
      fields: ["product_id", "device_id", "note"],
      filters: { product_id: productIds },
    }),
    query.graph({ entity: "product", fields: ["id", "variants.id"], filters: { id: productIds } }),
  ])
  const variantCount = new Map(products.map((p) => [p.id, p.variants?.length ?? 1]))

  for (const v of variants) {
    if (!v.sku || !v.product) continue
    const item = v.inventory_items?.[0]
    const levels = item?.inventory?.location_levels ?? []
    result.set(v.sku, {
      variant_id: v.id,
      product_id: v.product.id,
      product_title: v.product.title,
      product_handle: v.product.handle,
      product_status: v.product.status,
      variant_count: variantCount.get(v.product.id) ?? 1,
      manage_inventory: Boolean(v.manage_inventory),
      inventory_item_id: item?.inventory_item_id ?? null,
      level_exists: levels.some((l: any) => l?.location_id === locationId),
      category_ids: (v.product.categories ?? []).map((c: any) => c.id),
      devices: links
        .filter((l) => l.product_id === v.product.id)
        .map((l) => ({ device_id: l.device_id, note: l.note ?? null })),
      safety_marking: (v.product.product_attributes?.safety_marking ?? "none") as SafetyMarking,
      tags: (v.product.tags ?? []).map((t: any) => t?.value).filter(Boolean),
      prices: (v.prices ?? [])
        .filter((p: any) => p && !p.price_list_id)
        .map((p: any) => ({
          id: p.id,
          currency_code: p.currency_code,
          amount: Number(p.amount),
          rules_count: p.rules_count ?? 0,
        })),
    })
  }
  return result
}

export type BuildProductImportPlanInput = {
  csv: string
  /** Import (not preview): a file-level error fails the step, so nothing is written. */
  fail_on_file_errors?: boolean
}

/**
 * Reads the CSV and decides what each row will do, against the current
 * database. Read-only: the preview route runs only this step.
 */
export const buildProductImportPlanStep = createStep(
  "build-product-import-plan",
  async ({ csv, fail_on_file_errors }: BuildProductImportPlanInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as unknown as Query
    const read = readImportRows(csv)
    if (fail_on_file_errors && read.file_errors.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, read.file_errors.join(" "))
    }
    const defaults = await loadDefaults(query)

    const skus = [...new Set(read.rows.map((r) => r.input.sku).filter(Boolean))]
    const [variantsBySku, { data: products }, categories, { data: devices }] =
      await Promise.all([
        loadExistingVariants(query, skus, defaults.location_id),
        query.graph({ entity: "product", fields: ["id", "handle"] }),
        loadCategories(query),
        query.graph({ entity: "device", fields: ["id", "slug"] }),
      ])

    const plan = buildImportPlan(read, {
      variantsBySku,
      productIdByHandle: new Map(products.map((p) => [p.handle, p.id])),
      categories,
      deviceIdBySlug: new Map(devices.map((d) => [d.slug, d.id])),
    })
    return new StepResponse<BuildProductImportPlanOutput>({ plan, defaults })
  }
)
