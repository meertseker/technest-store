import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  batchInventoryItemLevelsWorkflow,
  createProductsWorkflow,
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { ProductStatus } from "@medusajs/framework/utils"
import { ImportPlan, PlanRow } from "../lib/product-import/plan"
import { buildProductImportPlanStep } from "./steps/build-product-import-plan"
import { replaceDeviceLinksStep } from "./steps/replace-device-links"
import { upsertImportAttributesStep } from "./steps/upsert-import-attributes"

export type ImportProductsWorkflowInput = { csv: string }

export type ImportProductsResult = {
  plan: ImportPlan
  created: number
  updated: number
  skipped: number
}

/** A dry run: what the import would do, row by row. Writes nothing. */
export const previewProductImportWorkflow = createWorkflow(
  "preview-product-import",
  function (input: ImportProductsWorkflowInput) {
    const { plan } = buildProductImportPlanStep(input)
    return new WorkflowResponse(plan)
  }
)

const GBP = "gbp"

type Ready = PlanRow & { resolved: NonNullable<PlanRow["resolved"]> }
const ready = (plan: ImportPlan): Ready[] =>
  plan.file_errors.length ? [] : (plan.rows.filter((r) => r.resolved) as Ready[])

/**
 * Imports a stock-list CSV: an idempotent upsert by SKU. Rows with errors are
 * skipped; every other row is written in one run, and a failure anywhere
 * rolls all of them back.
 *
 * Order matters for the publish guard (chargers need UKCA/CE, no vapes):
 * new products are created as drafts, attributes and device links are
 * written, then one product update sets category and final status, and the
 * guard hook checks the finished products.
 */
export const importProductsWorkflow = createWorkflow(
  "import-products",
  function (input: ImportProductsWorkflowInput) {
    const { plan, defaults } = buildProductImportPlanStep(input)

    const createInput = transform({ plan, defaults }, ({ plan, defaults }) => ({
      products: ready(plan)
        .filter((r) => r.action === "create")
        .map((r) => ({
          title: r.input.title!,
          handle: r.resolved.handle,
          description: r.input.description,
          status: ProductStatus.DRAFT,
          category_ids: r.resolved.category_id ? [r.resolved.category_id] : [],
          shipping_profile_id: defaults.shipping_profile_id,
          sales_channels: [{ id: defaults.sales_channel_id }],
          variants: [
            {
              title: "Default",
              sku: r.sku,
              manage_inventory: true,
              prices: [{ currency_code: GBP, amount: r.input.price! }],
            },
          ],
        })),
    }))
    const created = createProductsWorkflow.runAsStep({ input: createInput })

    // Product id for every row we write, new products included.
    const rows = transform({ plan, created }, ({ plan, created }) => {
      const idByHandle = new Map(created.map((p) => [p.handle, p.id]))
      return ready(plan).map((r) => ({
        ...r,
        product_id: r.resolved.product_id ?? idByHandle.get(r.resolved.handle)!,
      }))
    })

    const attributes = transform({ rows }, ({ rows }) =>
      rows
        .filter((r) => !r.resolved.variant_only)
        .map((r) => ({ product_id: r.product_id, values: r.resolved.attributes }))
    )
    upsertImportAttributesStep(attributes)

    const deviceChange = transform({ rows }, ({ rows }) => {
      const changed = rows.filter((r) => r.resolved.devices !== null)
      return {
        dismiss: changed.flatMap((r) =>
          r.resolved.previous_devices.map((d) => ({
            product_id: r.product_id,
            device_id: d.device_id,
          }))
        ),
        create: changed.flatMap((r) =>
          r.resolved.devices!.map((d) => ({
            product_id: r.product_id,
            device_id: d.device_id,
            note: d.note,
          }))
        ),
      }
    })
    replaceDeviceLinksStep(deviceChange)

    const productUpdates = transform({ rows }, ({ rows }) => ({
      products: rows
        .filter((r) => !r.resolved.variant_only)
        .map((r) => ({
          id: r.product_id,
          status: r.status as ProductStatus,
          ...(r.action === "update" && r.input.title ? { title: r.input.title } : {}),
          ...(r.action === "update" && r.input.handle ? { handle: r.input.handle } : {}),
          ...(r.action === "update" && r.input.description
            ? { description: r.input.description }
            : {}),
          ...(r.action === "update" && r.resolved.category_id
            ? { category_ids: [r.resolved.category_id] }
            : {}),
        })),
    }))
    updateProductsWorkflow.runAsStep({ input: productUpdates })

    const priceUpdates = transform({ rows }, ({ rows }) => ({
      product_variants: rows
        .filter((r) => r.action === "update" && r.input.price !== undefined)
        .map((r) => ({
          id: r.resolved.variant_id!,
          prices: [{ currency_code: GBP, amount: r.input.price! }],
        })),
    }))
    updateProductVariantsWorkflow.runAsStep({ input: priceUpdates })

    // Stock at the shop's location. New variants got inventory items on create.
    // An empty `sku` filter would match every variant, so keep it non-empty.
    const skus = transform({ rows }, ({ rows }) => {
      const list = rows.filter((r) => r.action === "create").map((r) => r.sku)
      return list.length ? list : ["\u0000none"]
    })
    const { data: newVariants } = useQueryGraphStep({
      entity: "product_variant",
      fields: ["id", "sku", "inventory_items.inventory_item_id"],
      filters: { sku: skus },
    }).config({ name: "load-imported-inventory-items" })

    const levels = transform(
      { rows, newVariants, defaults },
      ({ rows, newVariants, defaults }) => {
        const itemBySku = new Map(
          newVariants.map((v: any) => [v.sku, v.inventory_items?.[0]?.inventory_item_id])
        )
        const create: { inventory_item_id: string; location_id: string; stocked_quantity: number }[] = []
        const update: typeof create = []
        for (const r of rows) {
          if (r.action === "create") {
            const item = itemBySku.get(r.sku)
            if (item) {
              create.push({
                inventory_item_id: item,
                location_id: defaults.location_id,
                stocked_quantity: r.input.stock ?? 0,
              })
            }
          } else if (
            r.input.stock !== undefined &&
            r.resolved.manage_inventory &&
            r.resolved.inventory_item_id
          ) {
            const level = {
              inventory_item_id: r.resolved.inventory_item_id,
              location_id: defaults.location_id,
              stocked_quantity: r.input.stock,
            }
            if (r.resolved.level_exists) update.push(level)
            else create.push(level)
          }
        }
        return { create, update, delete: [] as string[] }
      }
    )
    batchInventoryItemLevelsWorkflow.runAsStep({ input: levels })

    const result = transform({ plan, rows }, ({ plan, rows }) => ({
      plan,
      created: rows.filter((r) => r.action === "create").length,
      updated: rows.filter((r) => r.action === "update").length,
      skipped: plan.rows.length - rows.length,
    }))
    return new WorkflowResponse<ImportProductsResult>(result)
  }
)
