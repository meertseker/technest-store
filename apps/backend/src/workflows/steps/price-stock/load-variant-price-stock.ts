import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { loadDefaults } from "../build-product-import-plan"

export type VariantPriceStock = {
  variant_id: string
  /** The variant's plain GBP price (no price list), null when it has none yet. */
  gbp_price_id: string | null
  price_pence: number | null
  inventory_item_id: string | null
  /** The shop's stock location (the one the import and Quick add use). */
  location_id: string
  /** True when the item already has a level at that location. */
  has_level: boolean
  stock: number | null
}

const VARIANT_FIELDS = [
  "id",
  "product_id",
  "price_set.id",
  "price_set.prices.id",
  "price_set.prices.currency_code",
  "price_set.prices.amount",
  "price_set.prices.price_list_id",
  "inventory_items.inventory_item_id",
  "inventory_items.inventory.id",
  "inventory_items.inventory.location_levels.location_id",
  "inventory_items.inventory.location_levels.stocked_quantity",
]

type Row = {
  id: string
  product_id: string
  price_set?: {
    id: string
    prices?: ({ id: string; currency_code: string; amount: unknown; price_list_id?: string | null } | null)[] | null
  } | null
  inventory_items?: ({
    inventory_item_id: string
    inventory?: {
      id: string
      location_levels?: ({ location_id: string; stocked_quantity: unknown } | null)[] | null
    } | null
  } | null)[] | null
}

/** Medusa stores amounts as-is in major units (3.49 = £3.49); our API talks in integer pence. */
export const amountToPence = (amount: unknown) => Math.round(Number(amount) * 100)

export async function readVariantPriceStock(
  container: { resolve: (key: string) => any },
  variantId: string,
  productId?: string
): Promise<VariantPriceStock> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const defaults = await loadDefaults(query)
  const { data } = await query.graph({
    entity: "product_variant",
    fields: VARIANT_FIELDS,
    filters: { id: variantId },
  })
  const variant = data[0] as Row | undefined
  if (!variant || (productId && variant.product_id !== productId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Variant ${variantId} not found on this product`)
  }
  const gbp = (variant.price_set?.prices ?? []).find(
    (p) => !!p && p.currency_code === "gbp" && !p.price_list_id
  )
  const item = (variant.inventory_items ?? []).find((i) => !!i) ?? null
  const level = (item?.inventory?.location_levels ?? []).find(
    (l) => !!l && l.location_id === defaults.location_id
  )
  return {
    variant_id: variant.id,
    gbp_price_id: gbp?.id ?? null,
    price_pence: gbp ? amountToPence(gbp.amount) : null,
    inventory_item_id: item?.inventory_item_id ?? null,
    location_id: defaults.location_id,
    has_level: !!level,
    stock: level ? Number(level.stocked_quantity) : null,
  }
}

/** Loads the variant for a price/stock update (404 when it is not on the product). */
export const loadVariantPriceStockStep = createStep(
  "load-variant-price-stock",
  async (input: { product_id: string; variant_id: string; stock?: number }, { container }) => {
    const current = await readVariantPriceStock(container, input.variant_id, input.product_id)
    if (input.stock !== undefined && !current.inventory_item_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "This product's stock is not tracked here, so its stock can't be changed from this page."
      )
    }
    return new StepResponse(current)
  }
)

/** Reads the values back after the update, for the response. */
export const readVariantPriceStockStep = createStep(
  "read-variant-price-stock",
  async (input: { variant_id: string }, { container }) => {
    const current = await readVariantPriceStock(container, input.variant_id)
    return new StepResponse({
      variant_id: current.variant_id,
      price_pence: current.price_pence,
      stock: current.stock,
    })
  }
)
