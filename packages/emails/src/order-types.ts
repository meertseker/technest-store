/** Payload for order emails. Money is integer pence (GBP), VAT-inclusive. */
export type OrderEmailItem = {
  title: string
  variant_title?: string | null
  quantity: number
  unit_price_pence: number
  total_pence: number
}

export type OrderEmailData = {
  display_id: number | string
  first_name?: string | null
  items: OrderEmailItem[]
  subtotal_pence: number
  shipping_total_pence: number
  discount_total_pence: number
  /** VAT included in total_pence (UK prices are VAT-inclusive). */
  tax_total_pence: number
  total_pence: number
  fulfilment: { type: "delivery" | "collection"; method_name: string }
  shipping_address?: {
    name?: string | null
    address_1?: string | null
    address_2?: string | null
    city?: string | null
    postcode?: string | null
  } | null
  order_url: string
}

/** The minimum every order-lifecycle email needs. */
export type OrderRef = {
  display_id: number | string
  first_name?: string | null
  order_url: string
}

export type OrderLine = { title: string; variant_title?: string | null; quantity: number }

export type OrderDispatchedData = OrderRef & {
  items: OrderLine[]
  /** Carrier tracking, when the fulfilment provider gave us one. */
  tracking: { number: string; url?: string | null }[]
  shipping_address?: OrderEmailData["shipping_address"]
}

export type OrderCancelledData = OrderRef & {
  /** Why: uncollected = the day-7 Click & Collect auto-cancel. */
  reason: "uncollected" | "other"
  /** released = the card hold was dropped, refunded = money is on its way back. */
  payment: "released" | "refunded" | "none"
  refunded_pence: number
}

export type RefundIssuedData = OrderRef & {
  amount_pence: number
  /** True when the whole order total has now been refunded. */
  full: boolean
}

export type ReturnReceivedData = OrderRef & { items: OrderLine[] }
