import { IPricingModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PriceWrite } from "../../lib/product-import/plan"

export type SetImportVariantPricesInput = {
  variant_id: string
  /** The variant's non price-list prices after the import, major units (3.49 = £3.49). */
  prices: PriceWrite
}[]

type PriceSetSnapshot = {
  id: string
  prices: { id: string; currency_code: string; amount: number }[]
}

/**
 * Writes existing variants' prices (price-list prices are never touched).
 *
 * Not `updateProductVariantsWorkflow`: in 2.21 its `update-price-sets`
 * compensation re-upserts the price sets without their prices, which deletes
 * every price of the variant when a later step fails. This step snapshots the
 * prices first and restores them exactly (same ids, so price rules stay).
 * It never deletes a price: one missing from the input is sent back unchanged.
 */
export const setImportVariantPricesStep = createStep(
  "set-import-variant-prices",
  async (input: SetImportVariantPricesInput, { container }) => {
    if (!input.length) return new StepResponse([] as string[], [] as PriceSetSnapshot[])

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const pricing: IPricingModuleService = container.resolve(Modules.PRICING)

    const { data: variants } = await query.graph({
      entity: "product_variant",
      fields: ["id", "price_set.id"],
      filters: { id: input.map((r) => r.variant_id) },
    })
    const setIdByVariant = new Map(
      variants.map((v) => [v.id, (v as { price_set?: { id: string } | null }).price_set?.id])
    )
    const setIds = [...new Set([...setIdByVariant.values()].filter(Boolean))] as string[]

    const existing = setIds.length
      ? await pricing.listPrices(
          { price_set_id: setIds, price_list_id: null } as Record<string, unknown>,
          { select: ["id", "currency_code", "amount", "price_set_id"], take: null }
        )
      : []
    const snapshot: PriceSetSnapshot[] = setIds.map((id) => ({
      id,
      prices: existing
        .filter((p) => (p as { price_set_id?: string }).price_set_id === id)
        .map((p) => ({
          id: p.id,
          currency_code: p.currency_code!,
          amount: Number(p.amount),
        })),
    }))
    const snapshotById = new Map(snapshot.map((s) => [s.id, s]))

    const updates = input.map((row) => {
      const setId = setIdByVariant.get(row.variant_id)
      if (!setId) {
        // Every variant created by Medusa has a price set; this is a broken variant.
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Variant ${row.variant_id} has no price set, so its price can't be imported.`
        )
      }
      const incoming = new Set(row.prices.map((p) => p.id).filter(Boolean))
      const kept = snapshotById
        .get(setId)!
        .prices.filter((p) => !incoming.has(p.id))
      return { id: setId, prices: [...kept, ...row.prices] }
    })
    await pricing.upsertPriceSets(updates)

    return new StepResponse(
      input.map((r) => r.variant_id),
      snapshot
    )
  },
  async (snapshot, { container }) => {
    if (!snapshot?.length) return
    const pricing: IPricingModuleService = container.resolve(Modules.PRICING)
    // Same ids: amounts go back, prices the step added are removed.
    await pricing.upsertPriceSets(snapshot)
  }
)
