import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  createProductsWorkflow,
  createProductVariantsWorkflow,
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"
import { assertProductsPublishable } from "../steps/assert-products-publishable"

// Publish guard (brief: chargers and power products need UKCA or CE; vapes are
// never listed; tracked stock only). Runs after every product create/update,
// admin UI and CSV import included; throwing rolls the product write back.
// Every write to a published product is checked, not only the one that
// publishes it: a live product that breaks a rule must be fixed (or taken
// back to draft) before anything else on it changes.
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

/** The products the variants belong to (the hook payload carries product_id; looked up when it doesn't). */
async function productIdsOfVariants(
  container: { resolve: (key: string) => any },
  variants: { id: string; product_id?: string | null }[]
): Promise<string[]> {
  const known = variants.map((v) => v.product_id).filter((id): id is string => Boolean(id))
  if (known.length === variants.length) return [...new Set(known)]
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["id", "product_id"],
    filters: { id: variants.map((v) => v.id) },
  })
  return [...new Set((data as { product_id?: string | null }[]).map((v) => v.product_id).filter(Boolean) as string[])]
}

// The same guard for variant writes (the admin variant routes, batch
// included): turning off stock tracking or allowing backorders on a variant
// of a published product would otherwise skip the product hooks above.
createProductVariantsWorkflow.hooks.productVariantsCreated(async ({ product_variants }, { container }) => {
  await assertProductsPublishable(container, await productIdsOfVariants(container, product_variants as any))
  return new StepResponse(undefined)
})

updateProductVariantsWorkflow.hooks.productVariantsUpdated(async ({ product_variants }, { container }) => {
  await assertProductsPublishable(container, await productIdsOfVariants(container, product_variants as any))
  return new StepResponse(undefined)
})
