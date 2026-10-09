/** Payloads for trade, repair and stock emails (docs/contracts/emails.md, trade.md, repairs.md). */
/**
 * Customer copies deliberately carry nothing the applicant typed (no company
 * name): the account's address is not verified, so typed text would let anyone
 * put their own message in a genuine Tech Nest email to any address.
 */
export type TradeApplicationEmailData = {
  first_name?: string | null
  /** Shown to the customer on rejection, as written by staff. */
  reason?: string | null
}

export type ShopTradeApplicationData = {
  company_name: string
  business_type: string
  vat_number?: string | null
  companies_house_number?: string | null
  contact: { name: string; phone: string; email: string }
  admin_url: string
}

export type ShopRepairBookingData = {
  name: string
  phone: string
  email: string
  device: string
  fault: string
  preferred_time: string
  admin_url: string
}

export type LowStockLine = {
  product_title: string
  variant_title?: string | null
  sku?: string | null
  /** Units in stock at the shop (null when unknown). */
  stocked: number | null
  reorder_level?: number | null
}

export type ShopLowStockDigestData = { date: string; lines: LowStockLine[]; admin_url: string }
