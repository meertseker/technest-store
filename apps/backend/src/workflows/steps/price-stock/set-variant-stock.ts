import { MathBN, MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type StockChangeInput = {
  /** Stocked quantity at the shop right now; null when the item has no level there. */
  current: number | null
  /** Units set aside for orders that have not been sent yet. */
  reserved: number
  desired: number
  /** What the person saw when they typed the new number; undefined = not given. */
  expected?: number | null
}

/**
 * Why a new stock number must not be written, or null when it may.
 *
 * The number typed on the page replaces the stored one, so it is only safe
 * when it was typed against the current stock: if an order shipped (or a
 * colleague saved) in between, writing it would bring sold units back.
 * It can also never go below what is reserved for open orders, or shipping
 * those orders would take the stock negative.
 */
export function stockChangeProblem({
  current,
  reserved,
  desired,
  expected,
}: StockChangeInput): { type: "conflict" | "invalid_data"; message: string } | null {
  if (expected !== undefined && expected !== current) {
    return {
      type: "conflict",
      message:
        current === null
          ? "The stock for this product changed since the page was loaded. Reload and try again."
          : `The stock for this product is now ${current}, not ${expected ?? "empty"}: it changed since the page was loaded. Reload and try again.`,
    }
  }
  if (desired < reserved) {
    return {
      type: "invalid_data",
      message: `${reserved} ${reserved === 1 ? "is" : "are"} set aside for orders that have not been sent yet, so the stock can't be lower than ${reserved}.`,
    }
  }
  return null
}

export type SetVariantStockInput = {
  inventory_item_id: string
  location_id: string
  stock: number
  expected_stock?: number | null
}

type Undo =
  | { created_level_id: string }
  | { inventory_item_id: string; location_id: string; delta: number }
  | null

/**
 * Sets the stocked quantity of one item at the shop, under the inventory
 * item's lock (the one Medusa takes when an order's stock is taken), so it
 * can't land in the middle of a shipment's own stock change.
 *
 * Undo puts back the difference, not the old number, so stock that moved in
 * the meantime is kept.
 */
export const setVariantStockStep = createStep(
  "set-variant-stock",
  async (input: SetVariantStockInput, { container }) => {
    const inventory = container.resolve(Modules.INVENTORY)
    const locking = container.resolve(Modules.LOCKING)

    const { level_id, created, undo } = await locking.execute(input.inventory_item_id, async () => {
      const [level] = await inventory.listInventoryLevels({
        inventory_item_id: input.inventory_item_id,
        location_id: input.location_id,
      })
      const current = level ? Number(level.stocked_quantity) : null
      const problem = stockChangeProblem({
        current,
        reserved: level ? Number(level.reserved_quantity) : 0,
        desired: input.stock,
        expected: input.expected_stock,
      })
      if (problem) {
        throw new MedusaError(
          problem.type === "conflict" ? MedusaError.Types.CONFLICT : MedusaError.Types.INVALID_DATA,
          problem.message
        )
      }
      if (!level) {
        const [made] = await inventory.createInventoryLevels([
          {
            inventory_item_id: input.inventory_item_id,
            location_id: input.location_id,
            stocked_quantity: input.stock,
          },
        ])
        return { level_id: made.id, created: true, undo: { created_level_id: made.id } as Undo }
      }
      if (current === input.stock) {
        return { level_id: level.id, created: false, undo: null as Undo }
      }
      await inventory.updateInventoryLevels([
        {
          inventory_item_id: input.inventory_item_id,
          location_id: input.location_id,
          stocked_quantity: input.stock,
        },
      ])
      return {
        level_id: level.id,
        created: false,
        undo: {
          inventory_item_id: input.inventory_item_id,
          location_id: input.location_id,
          delta: input.stock - (current as number),
        } as Undo,
      }
    })

    return new StepResponse({ level_id, created, changed: !!undo }, undo)
  },
  async (undo, { container }) => {
    if (!undo) return
    const inventory = container.resolve(Modules.INVENTORY)
    if ("created_level_id" in undo) {
      await inventory.deleteInventoryLevels([undo.created_level_id])
      return
    }
    await container.resolve(Modules.LOCKING).execute(undo.inventory_item_id, async () => {
      await inventory.adjustInventory(
        undo.inventory_item_id,
        undo.location_id,
        MathBN.mult(undo.delta, -1) as unknown as number
      )
    })
  }
)
