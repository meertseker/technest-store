import { DEFAULT_REORDER_LEVEL } from "../modules/product-attributes/utils"
import { londonDay } from "./email/trade-sources"

/**
 * Daily low-stock digest (docs/contracts/emails.md, row 16, and
 * docs/contracts/basket-rules.md "Low stock").
 */
export const LOW_STOCK_EVENT = "technest.inventory.low_stock"

/** Payload item of `technest.inventory.low_stock` (E2's contract, exactly). */
export type LowStockItem = {
  variant_id: string
  sku: string | null
  title: string
  /** Summed over the Tech Nest location's inventory levels. */
  stocked_quantity: number
  /** The reorder level the job compared against. */
  threshold: number
}

export type LowStockEventData = { items: LowStockItem[] }

/** Local hour (Europe/London) the digest goes out. */
export const LOW_STOCK_HOUR_LONDON = 8

/**
 * Fallback threshold for products without a product-attributes row:
 * env LOW_STOCK_THRESHOLD (integer >= 0), else 3 (the attributes default).
 */
export function defaultLowStockThreshold(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.LOW_STOCK_THRESHOLD?.trim()
  const n = raw ? Number(raw) : NaN
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_REORDER_LEVEL
}

const londonHour = (now: Date) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Europe/London",
    }).format(now)
  )

/** Last London hour (exclusive) a missed 08:00 digest is still sent: it is a morning email. */
export const LOW_STOCK_CATCH_UP_UNTIL_HOUR_LONDON = 12

/** What the job remembers between hourly runs (in memory: a restart simply checks again). */
export type LowStockRunState = { lastRunDay?: string; lastFailureReportDay?: string }

/**
 * The digest is due on the first run between 08:00 and noon London on a day
 * this process has not yet run it. Acting only inside the 08:00 hour meant a
 * worker that was down then (a deploy, a restart) sent no digest that day; a
 * worker that starts after noon waits for the next morning, so the shop never
 * gets a "daily" digest late in the evening. E2's email sends at most one
 * digest per London day whatever the hour, so a second run after a restart
 * is harmless.
 */
export function isLowStockDue(now: Date, state: LowStockRunState): boolean {
  const hour = londonHour(now)
  return (
    hour >= LOW_STOCK_HOUR_LONDON &&
    hour < LOW_STOCK_CATCH_UP_UNTIL_HOUR_LONDON &&
    state.lastRunDay !== londonDay(now)
  )
}

export type LowStockVariantRow = {
  id: string
  sku?: string | null
  title?: string | null
  manage_inventory?: boolean | null
  product?: {
    title?: string | null
    status?: string | null
    product_attributes?: { reorder_level?: number | null } | null
  } | null
  inventory_items?:
    | ({
        required_quantity?: number | null
        inventory?: {
          location_levels?:
            | ({
                location_id?: string | null
                stocked_quantity?: number | null
                reserved_quantity?: number | null
              } | null)[]
            | null
        } | null
      } | null)[]
    | null
}

function variantTitle(row: LowStockVariantRow): string {
  const product = row.product?.title?.trim()
  const variant = row.title?.trim()
  if (product && variant && variant !== product && variant.toLowerCase() !== "default") {
    return `${product} (${variant})`
  }
  return product || variant || row.id
}

/**
 * Picks the variants to reorder. A variant is low when its available stock at
 * the location (stocked minus reserved, so Click & Collect orders waiting on
 * the shelf count as gone) is at or below its product's `reorder_level`, or
 * `fallbackThreshold` when the product has no attributes row.
 * Skips variants that don't manage inventory, have no level at the location,
 * or belong to unpublished products. Emptiest first.
 */
export function selectLowStock(
  rows: LowStockVariantRow[],
  locationId: string | null,
  fallbackThreshold: number
): LowStockItem[] {
  const picked: (LowStockItem & { available: number })[] = []

  for (const row of rows) {
    if (row.manage_inventory === false) continue
    if (row.product?.status && row.product.status !== "published") continue

    let stocked: number | null = null
    let available: number | null = null
    for (const link of row.inventory_items ?? []) {
      const levels = (link?.inventory?.location_levels ?? []).filter(
        (level) => level && (!locationId || level.location_id === locationId)
      )
      if (!levels.length) continue
      const required = Math.max(1, Number(link?.required_quantity ?? 1))
      const itemStocked = levels.reduce((sum, l) => sum + Number(l?.stocked_quantity ?? 0), 0)
      const itemReserved = levels.reduce((sum, l) => sum + Number(l?.reserved_quantity ?? 0), 0)
      // A variant made of several inventory items is as available as its scarcest part.
      const itemAvailable = Math.floor((itemStocked - itemReserved) / required)
      const itemStockedUnits = Math.floor(itemStocked / required)
      available = available === null ? itemAvailable : Math.min(available, itemAvailable)
      stocked = stocked === null ? itemStockedUnits : Math.min(stocked, itemStockedUnits)
    }
    if (available === null || stocked === null) continue

    const reorderLevel = row.product?.product_attributes?.reorder_level
    const threshold =
      typeof reorderLevel === "number" && Number.isInteger(reorderLevel) && reorderLevel >= 0
        ? reorderLevel
        : fallbackThreshold
    if (available > threshold) continue

    picked.push({
      variant_id: row.id,
      sku: row.sku ?? null,
      title: variantTitle(row),
      stocked_quantity: stocked,
      threshold,
      available,
    })
  }

  return picked
    .sort((a, b) => a.available - b.available || a.title.localeCompare(b.title))
    .map(({ available: _available, ...item }) => item)
}
