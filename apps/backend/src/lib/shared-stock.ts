import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Medusa checks and reserves stock line by line. Two lines of the same
 * variant (they stay separate when their metadata differs), or of variants
 * sharing an inventory item, are each checked against the full stock, so
 * together they can reserve more than there is (medusajs/medusa#17032).
 * This catches that case before completion; single lines are left to Medusa.
 */

export type SharedStockLine = {
  variant_id: string
  quantity: number
  manage_inventory: boolean
  allow_backorder: boolean
  inventory_items: { inventory_item_id: string; required_quantity: number }[]
}

/** location id -> inventory item id -> available (stocked minus reserved). */
export type StockByLocation = Map<string, Map<string, number>>

/** Inventory items that two or more lines need more of than any one location has available. */
export function shortSharedInventory(lines: SharedStockLine[], available: StockByLocation): string[] {
  const need = new Map<string, { units: number; lines: number }>()
  for (const line of lines) {
    if (!line.manage_inventory || line.allow_backorder) continue
    for (const item of line.inventory_items) {
      const entry = need.get(item.inventory_item_id) ?? { units: 0, lines: 0 }
      entry.units += line.quantity * (item.required_quantity || 1)
      entry.lines += 1
      need.set(item.inventory_item_id, entry)
    }
  }
  const short: string[] = []
  for (const [itemId, { units, lines: count }] of need) {
    if (count < 2) continue
    const best = Math.max(0, ...[...available.values()].map((levels) => levels.get(itemId) ?? 0))
    if (best < units) short.push(itemId)
  }
  return short
}

type CartRow = {
  sales_channel_id?: string | null
  items?: ({ variant_id?: string | null; quantity?: unknown } | null)[] | null
}

type VariantRow = {
  id: string
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  inventory_items?: ({ inventory_item_id: string; required_quantity?: unknown } | null)[] | null
}

type LevelRow = {
  inventory_item_id: string
  location_id: string
  stocked_quantity?: unknown
  reserved_quantity?: unknown
}

/** Loads a cart's lines and the stock at its sales channel's locations, and checks them. */
export async function cartShortSharedInventory(container: MedusaContainer, cartId: string): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "sales_channel_id", "items.variant_id", "items.quantity"],
    filters: { id: cartId },
  })
  const cart = carts[0] as CartRow | undefined
  const items = (cart?.items ?? []).filter((i): i is { variant_id: string; quantity: unknown } => !!i?.variant_id)
  if (items.length < 2) return []

  const variantIds = [...new Set(items.map((i) => i.variant_id))]
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "manage_inventory",
      "allow_backorder",
      "inventory_items.inventory_item_id",
      "inventory_items.required_quantity",
    ],
    filters: { id: variantIds },
  })
  const byId = new Map((variants as unknown as VariantRow[]).map((v) => [v.id, v]))
  const lines: SharedStockLine[] = items.map((i) => {
    const v = byId.get(i.variant_id)
    return {
      variant_id: i.variant_id,
      quantity: Number(i.quantity) || 0,
      manage_inventory: !!v?.manage_inventory,
      allow_backorder: !!v?.allow_backorder,
      inventory_items: (v?.inventory_items ?? [])
        .filter((ii): ii is { inventory_item_id: string; required_quantity?: unknown } => !!ii)
        .map((ii) => ({ inventory_item_id: ii.inventory_item_id, required_quantity: Number(ii.required_quantity) || 1 })),
    }
  })
  const itemIds = [...new Set(lines.flatMap((l) => l.inventory_items.map((ii) => ii.inventory_item_id)))]
  if (!itemIds.length) return []

  // Medusa reserves only at the locations of the cart's sales channel.
  let locationIds: string[] | null = null
  if (cart?.sales_channel_id) {
    const { data: channels } = await query.graph({
      entity: "sales_channel",
      fields: ["id", "stock_locations.id"],
      filters: { id: cart.sales_channel_id },
    })
    locationIds = ((channels[0] as { stock_locations?: ({ id: string } | null)[] } | undefined)?.stock_locations ?? [])
      .filter((l): l is { id: string } => !!l)
      .map((l) => l.id)
  }
  const { data: levels } = await query.graph({
    entity: "inventory_level",
    fields: ["inventory_item_id", "location_id", "stocked_quantity", "reserved_quantity"],
    filters: { inventory_item_id: itemIds },
  })
  const available: StockByLocation = new Map()
  for (const level of levels as unknown as LevelRow[]) {
    if (locationIds && !locationIds.includes(level.location_id)) continue
    const at = available.get(level.location_id) ?? new Map<string, number>()
    at.set(level.inventory_item_id, Number(level.stocked_quantity ?? 0) - Number(level.reserved_quantity ?? 0))
    available.set(level.location_id, at)
  }
  return shortSharedInventory(lines, available)
}
