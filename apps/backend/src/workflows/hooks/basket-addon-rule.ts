import { StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  addShippingMethodToCartWorkflow,
  completeCartWorkflow,
} from "@medusajs/medusa/core-flows"
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
  await assertBasketRules(container, cart.id)
  return new StepResponse(undefined)
})
