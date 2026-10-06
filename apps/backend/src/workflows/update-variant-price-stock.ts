import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { InventoryLevelWorkflowEvents } from "@medusajs/framework/utils"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import {
  loadVariantPriceStockStep,
  readVariantPriceStockStep,
} from "./steps/price-stock/load-variant-price-stock"
import { setVariantStockStep } from "./steps/price-stock/set-variant-stock"
import { setImportVariantPricesStep } from "./steps/set-import-variant-prices"

export type UpdateVariantPriceStockInput = {
  product_id: string
  variant_id: string
  /** Retail price including VAT, integer pence. */
  price_pence?: number
  /** Stocked quantity at the shop. */
  stock?: number
  /**
   * The stock the page showed when the new number was typed (null = none).
   * When given and no longer true, nothing is written (409).
   */
  expected_stock?: number | null
}

/**
 * The admin's Price & stock tab: one variant's GBP price and/or its stock at
 * the shop.
 *
 * Stock first, because it is the write that can be refused (the stock moved
 * since the page was loaded, or the new number is below what open orders have
 * reserved); nothing has been written at that point. The price goes through
 * the import's price step, which changes that one price and can put it back
 * (never `updateProductVariantsWorkflow`: in 2.21 its undo wipes every price
 * of the variant).
 */
export const updateVariantPriceStockWorkflow = createWorkflow(
  "update-variant-price-stock",
  function (input: UpdateVariantPriceStockInput) {
    const current = loadVariantPriceStockStep({
      product_id: input.product_id,
      variant_id: input.variant_id,
      stock: input.stock,
      price_pence: input.price_pence,
    })

    const written = when(
      "set-stock",
      { input, current },
      ({ input, current }) => input.stock !== undefined && !!current.inventory_item_id
    ).then(() => {
      const stockInput = transform({ input, current }, ({ input, current }) => ({
        inventory_item_id: current.inventory_item_id!,
        location_id: current.location_id,
        stock: input.stock!,
        expected_stock: input.expected_stock,
      }))
      return setVariantStockStep(stockInput)
    })

    // The same events Medusa's own stock editing sends.
    when("stock-level-created", { written }, ({ written }) => !!written?.created).then(() => {
      emitEventStep({
        eventName: InventoryLevelWorkflowEvents.CREATED,
        data: transform({ written }, ({ written }) => [{ id: written!.level_id }]),
      }).config({ name: "emit-stock-level-created" })
    })
    when("stock-level-updated", { written }, ({ written }) => !!written && !written.created && written.changed).then(
      () => {
        emitEventStep({
          eventName: InventoryLevelWorkflowEvents.UPDATED,
          data: transform({ written }, ({ written }) => [{ id: written!.level_id }]),
        }).config({ name: "emit-stock-level-updated" })
      }
    )

    when("set-price", { input }, ({ input }) => input.price_pence !== undefined).then(() => {
      const prices = transform({ input, current }, ({ input, current }) => [
        {
          variant_id: current.variant_id,
          prices: [
            {
              ...(current.gbp_price_id ? { id: current.gbp_price_id } : {}),
              currency_code: "gbp",
              // The one pence -> major units conversion (Medusa stores 3.49 as 3.49).
              amount: input.price_pence! / 100,
            },
          ],
        },
      ])
      setImportVariantPricesStep(prices)
    })

    const result = readVariantPriceStockStep({ variant_id: input.variant_id })
    return new WorkflowResponse(result)
  }
)
