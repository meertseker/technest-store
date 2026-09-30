import { StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { assertProductsPublishable } from "../steps/assert-products-publishable"

// Publish guard (brief: chargers and power products need UKCA or CE; vapes are
// never listed). Runs after every product create/update, admin UI and CSV
// import included; throwing rolls the product write back.
createProductsWorkflow.hooks.productsCreated(async ({ products }, { container }) => {
  await assertProductsPublishable(
    container,
    products.map((p) => p.id)
  )
  return new StepResponse(undefined)
})

updateProductsWorkflow.hooks.productsUpdated(async ({ products }, { container }) => {
  await assertProductsPublishable(
    container,
    products.map((p) => p.id)
  )
  return new StepResponse(undefined)
})
