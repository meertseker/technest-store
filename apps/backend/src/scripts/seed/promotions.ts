import { MedusaContainer } from "@medusajs/framework"
import {
  ApplicationMethodAllocation,
  ApplicationMethodTargetType,
  ApplicationMethodType,
  ContainerRegistrationKeys,
  PromotionStatus,
  PromotionType,
} from "@medusajs/framework/utils"
import { createPromotionsWorkflow } from "@medusajs/medusa/core-flows"

/** Category of £1 add-on items (seed: "£1 Deals"). */
export const ADDON_CATEGORY_HANDLE = "1-deals"

/**
 * "Any 3 £1 add-ons for £2": buy 2 items from £1 Deals, the 3rd is free.
 * Applies repeatedly (6 for £4, ...) up to MAX_FREE free items per basket.
 * Automatic, so no code to type. See docs/contracts/basket-rules.md.
 */
export const ADDON_MULTIBUY = {
  code: "ADDONS-3-FOR-2",
  buy_quantity: 2,
  free_quantity: 1,
  max_free: 10,
}

export type SeedPromotionsResult = {
  created: boolean
  promotion_id: string | null
  reason?: "exists" | "no_addon_category"
}

/**
 * Idempotent: does nothing when the promotion code already exists (the owner
 * may have edited or deactivated it in the admin) or when the £1 Deals
 * category is missing.
 */
export async function seedPromotions(container: MedusaContainer): Promise<SeedPromotionsResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: existing } = await query.graph({
    entity: "promotion",
    fields: ["id"],
    filters: { code: ADDON_MULTIBUY.code },
  })
  if (existing.length) {
    logger.info(`Promotion ${ADDON_MULTIBUY.code} already exists; skipping.`)
    return { created: false, promotion_id: existing[0].id, reason: "exists" }
  }

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id"],
    filters: { handle: ADDON_CATEGORY_HANDLE },
  })
  const categoryId = categories[0]?.id
  if (!categoryId) {
    logger.warn(
      `Category "${ADDON_CATEGORY_HANDLE}" not found; add-on multi-buy promotion not created.`
    )
    return { created: false, promotion_id: null, reason: "no_addon_category" }
  }

  const inAddonCategory = [
    {
      attribute: "items.product.categories.id",
      operator: "in" as const,
      values: [categoryId],
    },
  ]
  const { result } = await createPromotionsWorkflow(container).run({
    input: {
      promotionsData: [
        {
          code: ADDON_MULTIBUY.code,
          type: PromotionType.BUYGET,
          status: PromotionStatus.ACTIVE,
          is_automatic: true,
          is_tax_inclusive: true,
          application_method: {
            type: ApplicationMethodType.PERCENTAGE,
            target_type: ApplicationMethodTargetType.ITEMS,
            allocation: ApplicationMethodAllocation.EACH,
            value: 100,
            buy_rules_min_quantity: ADDON_MULTIBUY.buy_quantity,
            apply_to_quantity: ADDON_MULTIBUY.free_quantity,
            max_quantity: ADDON_MULTIBUY.max_free,
            buy_rules: inAddonCategory,
            target_rules: inAddonCategory,
          },
        },
      ],
    },
  })
  logger.info(`Created promotion ${ADDON_MULTIBUY.code}.`)
  return { created: true, promotion_id: result[0].id }
}
