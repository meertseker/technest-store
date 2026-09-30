export const TRADE_APPLICATION_STATUSES = ["pending", "approved", "rejected"] as const
export type TradeApplicationStatus = (typeof TRADE_APPLICATION_STATUSES)[number]

export const BUSINESS_TYPES = [
  "sole_trader",
  "partnership",
  "limited_company",
  "other",
] as const
export type BusinessType = (typeof BUSINESS_TYPES)[number]

/** Exact name of the customer group and price list that carry trade pricing. */
export const TRADE_GROUP_NAME = "Trade"
export const TRADE_PRICE_LIST_TITLE = "Trade"

/** Quantity tiers used for trade price-list prices (max null = and above). */
export const TRADE_TIERS = [
  { min_quantity: 1, max_quantity: 9 },
  { min_quantity: 10, max_quantity: 49 },
  { min_quantity: 50, max_quantity: null },
] as const

export const UK_VAT_RATE_PERCENT = 20

export const TRADE_EVENTS = {
  CREATED: "technest.trade_application.created",
  APPROVED: "technest.trade_application.approved",
  REJECTED: "technest.trade_application.rejected",
} as const

export const TRADE_APPLICATION_FIELDS = [
  "id",
  "customer_id",
  "company_name",
  "vat_number",
  "companies_house_number",
  "business_type",
  "contact_name",
  "contact_phone",
  "contact_email",
  "status",
  "reason",
  "created_at",
  "updated_at",
]

export type TradeApplicationDTO = {
  id: string
  customer_id: string
  company_name: string
  vat_number: string | null
  companies_house_number: string | null
  business_type: BusinessType
  contact: { name: string; phone: string; email: string }
  status: TradeApplicationStatus
  reason: string | null
  created_at: string
  updated_at: string
}

const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : new Date(value as string).toISOString()

/** Maps a stored row to the contract shape (docs/contracts/trade.md). */
export function toTradeApplicationDTO(row: Record<string, unknown>): TradeApplicationDTO {
  return {
    id: row.id as string,
    customer_id: row.customer_id as string,
    company_name: row.company_name as string,
    vat_number: (row.vat_number as string | null) ?? null,
    companies_house_number: (row.companies_house_number as string | null) ?? null,
    business_type: row.business_type as BusinessType,
    contact: {
      name: row.contact_name as string,
      phone: row.contact_phone as string,
      email: row.contact_email as string,
    },
    status: row.status as TradeApplicationStatus,
    reason: (row.reason as string | null) ?? null,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  }
}

/** Integer pence from a Medusa major-unit amount (3.49 -> 349). */
export function toPence(amount: number | string): number {
  return Math.round(Number(amount) * 100 + Number.EPSILON)
}

/** Ex-VAT pence from VAT-inclusive pence at the UK standard rate. */
export function exVatPence(incVatPence: number): number {
  return Math.round((incVatPence * 100) / (100 + UK_VAT_RATE_PERCENT))
}
