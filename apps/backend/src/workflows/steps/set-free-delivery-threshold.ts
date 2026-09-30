import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  buildFreeDeliveryPrices,
  ExistingShippingPrice,
  restoreShippingPrices,
  STANDARD_DELIVERY_CODE,
} from "../../modules/settings/utils"

export type SetFreeDeliveryThresholdStepInput = {
  threshold_pence: number
}

type Snapshot = { price_set_id: string; prices: ExistingShippingPrice[] }

/** The Standard delivery option's price set id, or null when there is none. */
async function findStandardPriceSetId(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "type.code", "price_set_link.price_set_id"],
  })
  const standard = options.filter((o) => o.type?.code === STANDARD_DELIVERY_CODE)
  if (standard.length > 1) {
    // One Standard option per shop (seed); more would be a data error.
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`Found ${standard.length} "standard" shipping options; updating the first`)
  }
  const link = (standard[0] as Record<string, any> | undefined)?.price_set_link
  return (link?.price_set_id as string | undefined) ?? null
}

async function listPrices(container: MedusaContainer, priceSetId: string) {
  const pricing = container.resolve(Modules.PRICING)
  const prices = await pricing.listPrices(
    { price_set_id: [priceSetId], price_list_id: null } as any,
    { relations: ["price_rules"], take: null }
  )
  return prices.map(
    (p): ExistingShippingPrice => ({
      id: p.id,
      currency_code: p.currency_code!,
      amount: Number(p.amount),
      // PriceRuleDTO has no `operator` in its type, but the column exists.
      price_rules: ((p.price_rules ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
        attribute: String(r.attribute),
        operator: (r.operator as string | undefined) ?? "eq",
        value: String(r.value),
      })),
    })
  )
}

/**
 * Makes Standard delivery £0 when the cart's item_total (inc. VAT) is at or
 * above the threshold, via conditional prices on its price set (contract:
 * docs/contracts/settings.md). Next-day and Click & Collect are not touched.
 * No-op (with a warning) when the store has no Standard option yet.
 * Compensation puts the price set back to its previous prices and rules.
 */
export const setFreeDeliveryThresholdStep = createStep(
  "set-free-delivery-threshold",
  async (input: SetFreeDeliveryThresholdStepInput, { container }) => {
    const priceSetId = await findStandardPriceSetId(container)
    if (!priceSetId) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn("No Standard delivery shipping option; free-delivery threshold not applied")
      return new StepResponse({ applied: false }, null as Snapshot | null)
    }

    const before = await listPrices(container, priceSetId)
    const pricing = container.resolve(Modules.PRICING)
    await pricing.updatePriceSets(priceSetId, {
      prices: buildFreeDeliveryPrices(before, input.threshold_pence) as any,
    })

    return new StepResponse(
      { applied: true },
      { price_set_id: priceSetId, prices: before } as Snapshot | null
    )
  },
  async (snapshot, { container }) => {
    if (!snapshot) {
      return
    }
    const pricing = container.resolve(Modules.PRICING)
    await pricing.updatePriceSets(snapshot.price_set_id, {
      prices: restoreShippingPrices(snapshot.prices) as any,
    })
  }
)
