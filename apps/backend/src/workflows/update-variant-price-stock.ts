import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { batchInventoryItemLevelsWorkflow } from "@medusajs/medusa/core-flows"
import {
  loadVariantPriceStockStep,
  readVariantPriceStockStep,
} from "./steps/price-stock/load-variant-price-stock"
import { setImportVariantPricesStep } from "./steps/set-import-variant-prices"

export type UpdateVariantPriceStockInput = {
  product_id: string
  variant_id: string
  /** Retail price including VAT, integer pence. */
  price_pence?: number
  /** Stocked quantity at the shop. */
  stock?: number
}

/**
 * The admin's Price & stock tab: one variant's GBP price and/or its stock at
 * the shop. Prices go through the import's price step, which snapshots and
 * restores them (never `updateProductVariantsWorkflow`: in 2.21 its undo wipes
 * every price of the variant). Stock goes through Medusa's level batch flow.
 */
export const updateVariantPriceStockWorkflow = createWorkflow(
  "update-variant-price-stock",
  function (input: UpdateVariantPriceStockInput) {
    const current = loadVariantPriceStockStep({
      product_id: input.product_id,
      variant_id: input.variant_id,
      stock: input.stock,
    })

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

    when("set-stock", { input, current }, ({ input, current }) => input.stock !== undefined && !!current.inventory_item_id).then(
      () => {
        const levels = transform({ input, current }, ({ input, current }) => {
          const level = {
            inventory_item_id: current.inventory_item_id!,
            location_id: current.location_id,
            stocked_quantity: input.stock!,
          }
          return {
            create: current.has_level ? [] : [level],
            update: current.has_level ? [level] : [],
            delete: [] as string[],
          }
        })
        batchInventoryItemLevelsWorkflow.runAsStep({ input: levels })
      }
    )

    const result = readVariantPriceStockStep({ variant_id: input.variant_id })
    return new WorkflowResponse(result)
  }
)
