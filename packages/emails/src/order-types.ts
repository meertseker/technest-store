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
