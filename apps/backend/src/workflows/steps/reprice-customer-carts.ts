import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { refreshCartItemsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Re-prices every open (not completed) cart of the customer, so prices that
 * came from a customer-group price list they just left no longer apply.
 * Checkout charges the unit price stored on the cart, so without this a
 * trade-priced basket built before a revoke could still be paid at trade
 * prices. The refresh also renews the cart's payment collection, so a payment
 * started at the old total has to be started again.
 *
 * No compensation: if the surrounding workflow rolls back, the customer is put
 * back in the group and their next basket change prices them as trade again;
 * retail prices in the meantime cost the shop nothing.
 */
export const repriceCustomerCartsStep = createStep(
  "reprice-customer-carts",
  async ({ customer_id }: { customer_id: string }, { container }) => {
    const carts = await container
      .resolve(Modules.CART)
      // `completed_at: null` (still open) works at runtime; the filter type only declares operators.
      .listCarts({ customer_id, completed_at: null } as any, { select: ["id"], take: null })
    for (const cart of carts) {
      await refreshCartItemsWorkflow(container).run({
        input: { cart_id: cart.id, force_refresh: true },
      })
    }
    return new StepResponse({ carts: carts.length })
  }
)
