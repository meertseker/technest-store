import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { SHOP } from "../../scripts/seed/data"
import { LowStockItem, LowStockVariantRow, selectLowStock } from "../../lib/low-stock"

const PAGE_SIZE = 200

export type FindLowStockVariantsInput = {
  /** Compared when a product has no attributes row. */
  fallback_threshold: number
}

/**
 * Read-only: the variants at or below their reorder level at the shop's
 * stock location ("Tech Nest – Southwark Park Rd"; the only location, so
 * any single location is used when that name isn't found).
 */
export const findLowStockVariantsStep = createStep(
  "find-low-stock-variants",
  async (input: FindLowStockVariantsInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    const { data: locations } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    const shop =
      locations.find((l) => l.name === SHOP.locationName) ??
      (locations.length === 1 ? locations[0] : undefined)
    if (!shop) {
      logger.warn(
        `Low-stock check: stock location "${SHOP.locationName}" not found; summing every location.`
      )
    }

    const rows: LowStockVariantRow[] = []
    for (let skip = 0; ; skip += PAGE_SIZE) {
      const { data } = await query.graph({
        entity: "product_variant",
        fields: [
          "id",
          "sku",
          "title",
          "manage_inventory",
          "product.title",
          "product.status",
          "product.product_attributes.reorder_level",
          "inventory_items.required_quantity",
          "inventory_items.inventory.location_levels.location_id",
          "inventory_items.inventory.location_levels.stocked_quantity",
          "inventory_items.inventory.location_levels.reserved_quantity",
        ],
        filters: { manage_inventory: true },
        pagination: { skip, take: PAGE_SIZE, order: { id: "ASC" } },
      })
      rows.push(...(data as LowStockVariantRow[]))
      if (data.length < PAGE_SIZE) break
    }

    const items: LowStockItem[] = selectLowStock(
      rows,
      shop?.id ?? null,
      input.fallback_threshold
    )
    return new StepResponse(items)
  }
)
