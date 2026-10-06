import { IPricingModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PriceWrite } from "../../lib/product-import/plan"

export type SetImportVariantPricesInput = {
  variant_id: string
  /**
   * Prices to write, major units (3.49 = £3.49): with an `id` the price is
   * changed, without one it is added. Prices not listed are left alone.
   */
  prices: PriceWrite
}[]

type PriceSetSnapshot = {
  id: string
  prices: { id: string; currency_code: string; amount: number }[]
}

async function plainPrices(pricing: IPricingModuleService, setIds: string[]) {
  if (!setIds.length) return []
  const prices = await pricing.listPrices(
    { price_set_id: setIds, price_list_id: null } as Record<string, unknown>,
    { select: ["id", "currency_code", "amount", "price_set_id"], take: null }
  )
  return prices.map((p) => ({
    id: p.id,
    currency_code: p.currency_code!,
    amount: Number(p.amount),
    price_set_id: (p as { price_set_id?: string }).price_set_id as string,
  }))
}

/**
 * Writes existing variants' prices (price-list prices are never touched).
 *
 * Only the prices that change are sent, and they are added to the price set
 * (`addPrices`), never written as "the whole set". Two things this avoids in
 * Medusa 2.21:
 *  - replacing a price set (`upsertPriceSets`, `updateProductVariantsWorkflow`)
 *    deletes every price that is not in the input, and treats prices with the
 *    same currency as one, so a variant's quantity-tier or region price would
 *    disappear when its plain price is changed;
 *  - `updateProductVariantsWorkflow`'s undo re-writes the price sets without
 *    their prices, deleting all of them when a later step fails.
 *
 * Undo puts the old amounts back by id and removes the prices this step added.
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

    const existing = await plainPrices(pricing, setIds)
    const snapshot: PriceSetSnapshot[] = setIds.map((id) => ({
      id,
      prices: existing
        .filter((p) => p.price_set_id === id)
        .map(({ id, currency_code, amount }) => ({ id, currency_code, amount })),
    }))
    const snapshotById = new Map(snapshot.map((s) => [s.id, s]))

    const writes = input
      .map((row) => {
        const setId = setIdByVariant.get(row.variant_id)
        if (!setId) {
          // Every variant created by Medusa has a price set; this is a broken variant.
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Variant ${row.variant_id} has no price set, so its price can't be imported.`
          )
        }
        const before = new Map(snapshotById.get(setId)!.prices.map((p) => [p.id, p]))
        const prices = row.prices.filter((p) => {
          if (!p.id) return true
          const was = before.get(p.id)
          if (!was) {
            throw new MedusaError(
              MedusaError.Types.INVALID_DATA,
              `Price ${p.id} is not one of variant ${row.variant_id}'s own prices.`
            )
          }
          return was.amount !== p.amount || was.currency_code !== p.currency_code
        })
        return { priceSetId: setId, prices }
      })
      .filter((w) => w.prices.length)
    if (writes.length) {
      await pricing.addPrices(writes)
    }

    return new StepResponse(
      input.map((r) => r.variant_id),
      snapshot
    )
  },
  async (snapshot, { container }) => {
    if (!snapshot?.length) return
    const pricing: IPricingModuleService = container.resolve(Modules.PRICING)
    const now = await plainPrices(
      pricing,
      snapshot.map((s) => s.id)
    )
    const before = new Map(snapshot.flatMap((s) => s.prices.map((p) => [p.id, p] as const)))

    const added = now.filter((p) => !before.has(p.id)).map((p) => p.id)
    if (added.length) {
      await pricing.softDeletePrices(added)
    }
    const restore = snapshot
      .map((s) => ({
        priceSetId: s.id,
        prices: s.prices.filter((p) => {
          const current = now.find((n) => n.id === p.id)
          return !!current && (current.amount !== p.amount || current.currency_code !== p.currency_code)
        }),
      }))
      .filter((r) => r.prices.length)
    if (restore.length) {
      await pricing.addPrices(restore)
    }
  }
)
