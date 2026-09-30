import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { filterStoreProductIds } from "../../api/utils/devices"
import { isTradeCustomer, listTradeTiers } from "../../lib/trade-tiers"

/** Read-only: fails with 403 unless the customer is in the "Trade" group. */
export const assertTradeCustomerStep = createStep(
  "assert-trade-customer",
  async ({ customer_id }: { customer_id: string }, { container }) => {
    if (!(await isTradeCustomer(container, customer_id))) {
      throw new MedusaError(
        MedusaError.Types.FORBIDDEN,
        "Trade pricing is only available to approved trade accounts"
      )
    }
    return new StepResponse(undefined)
  }
)

/** Read-only: fails with 404 unless the product is published in one of the key's sales channels. */
export const assertStoreProductVisibleStep = createStep(
  "assert-store-product-visible",
  async (
    { product_id, sales_channel_ids }: { product_id: string; sales_channel_ids: string[] },
    { container }
  ) => {
    const [visible] = await filterStoreProductIds(container, [product_id], sales_channel_ids)
    if (!visible) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Product with id: ${product_id} was not found`
      )
    }
    return new StepResponse(undefined)
  }
)

/** Read-only: the product's retail and trade tier prices (docs/contracts/trade.md). */
export const listProductTradeTiersStep = createStep(
  "list-product-trade-tiers",
  async ({ product_id }: { product_id: string }, { container }) => {
    return new StepResponse(await listTradeTiers(container, product_id))
  }
)
