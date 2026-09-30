import {
  FilterablePriceListProps,
  IPricingModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  PriceListStatus,
} from "@medusajs/framework/utils"
import {
  exVatPence,
  toPence,
  toTradeApplicationDTO,
  TRADE_APPLICATION_FIELDS,
  TRADE_GROUP_NAME,
  TRADE_PRICE_LIST_TITLE,
  TradeApplicationDTO,
  TradeApplicationStatus,
  UK_VAT_RATE_PERCENT,
} from "../../modules/trade/constants"

type ListOptions = {
  filters: { id?: string; customer_id?: string; status?: TradeApplicationStatus[] }
  /** Field name, "-" prefix for descending. */
  order: string
  limit: number
  offset: number
}

export function orderBy(order: string): Record<string, "ASC" | "DESC"> {
  const desc = order.startsWith("-")
  return { [desc ? order.slice(1) : order]: desc ? "DESC" : "ASC" }
}

export async function listTradeApplicationDTOs(
  scope: MedusaContainer,
  { filters, order, limit, offset }: ListOptions
): Promise<{ applications: TradeApplicationDTO[]; count: number }> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data, metadata } = await query.graph({
    entity: "trade_application",
    fields: TRADE_APPLICATION_FIELDS,
    filters,
    pagination: { skip: offset, take: limit, order: { ...orderBy(order), id: "ASC" } },
  })
  return {
    applications: (data as Record<string, unknown>[]).map(toTradeApplicationDTO),
    count: metadata?.count ?? data.length,
  }
}

export async function retrieveTradeApplicationDTO(
  scope: MedusaContainer,
  id: string
): Promise<TradeApplicationDTO> {
  const { applications } = await listTradeApplicationDTOs(scope, {
    filters: { id },
    order: "created_at",
    limit: 1,
    offset: 0,
  })
  if (!applications.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Trade application with id: ${id} was not found`
    )
  }
  return applications[0]
}

/** True when the customer is in the "Trade" customer group (an approved trade account). */
export async function isTradeCustomer(scope: MedusaContainer, customerId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "groups.name"],
    filters: { id: customerId },
  })
  const groups = (data[0]?.groups ?? []) as { name?: string | null }[]
  return groups.some((g) => g?.name === TRADE_GROUP_NAME)
}

export type TradeTier = {
  min_quantity: number
  max_quantity: number | null
  unit_price_ex_vat_pence: number
  unit_price_inc_vat_pence: number
}

export type TradeTierVariant = {
  variant_id: string
  sku: string | null
  title: string
  retail_inc_vat_pence: number | null
  tiers: TradeTier[]
}

type PriceRow = {
  id: string
  price_set_id: string
  price_list_id: string | null
  currency_code: string
  amount: number | string
  min_quantity: number | string | null
  max_quantity: number | string | null
  rules_count: number | null
}

const CURRENCY = "gbp"
const PRICE_FIELDS = [
  "id",
  "price_set_id",
  "price_list_id",
  "currency_code",
  "amount",
  "min_quantity",
  "max_quantity",
  "rules_count",
]

/** Trade tier data for one product (docs/contracts/trade.md). */
export async function listTradeTiers(scope: MedusaContainer, productId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const pricing: IPricingModuleService = scope.resolve(Modules.PRICING)

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "sku", "title", "variant_rank", "price_set.id"],
    filters: { product_id: productId },
  })

  const priceSetIds = variants
    .map((v) => (v.price_set as { id?: string } | undefined)?.id)
    .filter((id): id is string => !!id)

  // Only an active list is applied in the basket, so only its prices are shown.
  const [tradeList] = await pricing.listPriceLists(
    // `title` is filterable at runtime; the public filter type just doesn't declare it.
    { title: TRADE_PRICE_LIST_TITLE, status: [PriceListStatus.ACTIVE] } as FilterablePriceListProps,
    { select: ["id"], take: 1 }
  )

  const prices = priceSetIds.length
    ? ((await pricing.listPrices(
        { price_set_id: priceSetIds, currency_code: CURRENCY },
        { select: PRICE_FIELDS as never[], take: null }
      )) as unknown as PriceRow[])
    : []

  const bySet = new Map<string, PriceRow[]>()
  for (const price of prices) {
    bySet.set(price.price_set_id, [...(bySet.get(price.price_set_id) ?? []), price])
  }

  const result: TradeTierVariant[] = [...variants]
    .sort(
      (a, b) =>
        Number(a.variant_rank ?? 0) - Number(b.variant_rank ?? 0) ||
        String(a.title).localeCompare(String(b.title))
    )
    .map((variant) => {
      const setId = (variant.price_set as { id?: string } | undefined)?.id
      const setPrices = setId ? bySet.get(setId) ?? [] : []
      const retail = setPrices.find(
        (p) =>
          !p.price_list_id &&
          !Number(p.rules_count ?? 0) &&
          p.min_quantity == null &&
          p.max_quantity == null
      )
      const tiers = setPrices
        .filter((p) => tradeList && p.price_list_id === tradeList.id)
        .map((p) => {
          const inc = toPence(p.amount)
          return {
            min_quantity: p.min_quantity == null ? 1 : Number(p.min_quantity),
            max_quantity: p.max_quantity == null ? null : Number(p.max_quantity),
            unit_price_ex_vat_pence: exVatPence(inc),
            unit_price_inc_vat_pence: inc,
          }
        })
        .sort((a, b) => a.min_quantity - b.min_quantity)
      return {
        variant_id: variant.id as string,
        sku: (variant.sku as string | null) ?? null,
        title: variant.title as string,
        retail_inc_vat_pence: retail ? toPence(retail.amount) : null,
        tiers,
      }
    })

  return {
    product_id: productId,
    currency_code: CURRENCY,
    price_label: "ex VAT",
    vat_rate_percent: UK_VAT_RATE_PERCENT,
    variants: result,
  }
}
