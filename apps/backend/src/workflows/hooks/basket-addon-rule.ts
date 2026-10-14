import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  addShippingMethodToCartWorkflow,
  completeCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { collectStateKeysIn } from "../../lib/click-collect"
import { cartShortSharedInventory } from "../../lib/shared-stock"
import { assertBasketRules } from "../steps/basket-rules"

// Add-on rule (CLAUDE.md, docs/contracts/basket-rules.md): a basket of only £1
// add-ons can't be delivered; Click & Collect is exempt. Checked when a
// shipping method is chosen and again at completion, because items can be
// removed after a delivery option was picked.

addShippingMethodToCartWorkflow.hooks.validate(async ({ input, cart }, { container }) => {
  await assertBasketRules(
    container,
    cart.id,
    (input.options ?? []).map((option) => option.id)
  )
  return new StepResponse(undefined)
})

completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  // Cart metadata becomes order metadata, where Click & Collect state lives.
  // The Store API drops the state keys (api/store/carts/middlewares.ts); a cart
  // that carries one anyway must not become an order that looks collected.
  if (collectStateKeysIn(cart.metadata).length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "This basket can't be checked out. Please start a new basket."
    )
  }
  await assertBasketRules(container, cart.id)
  // Lines sharing an inventory item are checked together (Medusa checks each
  // line alone). Refused here, before the payment step, so the card hold is
  // released like for any other out-of-stock refusal (lib/cart-completion).
  if ((await cartShortSharedInventory(container, cart.id)).length) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "We don't have enough stock for all the items in your basket. Please reduce the quantity and try again."
    )
  }
  return new StepResponse(undefined)
})
