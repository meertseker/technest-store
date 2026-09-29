import type { TemplateId } from "../index"
import type { OrderEmailData } from "../order-types"

const order: OrderEmailData = {
  display_id: 1042,
  first_name: "Sam",
  items: [
    { title: "USB-C to USB-C cable", variant_title: "1 m, black", quantity: 2, unit_price_pence: 499, total_pence: 998 },
    { title: "Screen protector", quantity: 1, unit_price_pence: 100, total_pence: 100 },
  ],
  subtotal_pence: 1098,
  shipping_total_pence: 349,
  discount_total_pence: 0,
  tax_total_pence: 241,
  total_pence: 1447,
  fulfilment: { type: "delivery", method_name: "Standard delivery" },
  shipping_address: { name: "Sam Smith", address_1: "1 High St", city: "London", postcode: "SE16 1AA" },
  order_url: "https://technest.co.uk/order/order_1/confirmed",
}

const collectionOrder: OrderEmailData = {
  ...order,
  fulfilment: { type: "collection", method_name: "Click & Collect" },
  shipping_total_pence: 0,
  total_pence: 1098,
  shipping_address: null,
}

// Sample data for the local preview. Keep one entry per template.
export const fixtures: Record<TemplateId, Record<string, unknown>> = {
  welcome: { first_name: "Sam" },
  "order-confirmation": order,
  "shop-new-order": collectionOrder,
  "password-reset": {
    reset_url: "https://technest.co.uk/account/reset-password?token=example&email=sam%40example.com",
    actor: "customer",
  },
}
