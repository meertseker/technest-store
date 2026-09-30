/** Types from docs/contracts/trade.md v1 (E1). Money is integer pence. */

export type TradeApplicationStatus = "pending" | "approved" | "rejected"

export type TradeApplication = {
  id: string
  customer_id: string
  company_name: string
  vat_number: string | null
  companies_house_number: string | null
  business_type: "sole_trader" | "partnership" | "limited_company" | "other"
  contact: { name: string; phone: string; email: string }
  status: TradeApplicationStatus
  reason: string | null
  created_at: string
  updated_at: string
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

export type TradeTiersResponse = {
  product_id: string
  currency_code: string
  price_label: string
  vat_rate_percent: number
  variants: TradeTierVariant[]
}
