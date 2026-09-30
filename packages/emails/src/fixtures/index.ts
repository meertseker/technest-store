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

const collection = {
  display_id: 1042,
  first_name: "Sam",
  order_url: order.order_url,
  collection_code: "K7QX4M",
  items: [{ title: "USB-C to USB-C cable", variant_title: "1 m, black", quantity: 2 }],
  today_hours: "Today (Saturday): 9am–8pm",
  hold_until: "Friday 9 October",
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
  "order-dispatched": {
    display_id: 1042,
    first_name: "Sam",
    order_url: order.order_url,
    items: [{ title: "USB-C to USB-C cable", variant_title: "1 m, black", quantity: 2 }],
    tracking: [{ number: "RM123456789GB", url: "https://www.royalmail.com/track-your-item#/tracking-results/RM123456789GB" }],
    shipping_address: order.shipping_address,
  },
  "order-cancelled": {
    display_id: 1042,
    first_name: "Sam",
    order_url: order.order_url,
    reason: "uncollected",
    payment: "released",
    refunded_pence: 0,
  },
  "refund-issued": { display_id: 1042, first_name: "Sam", order_url: order.order_url, amount_pence: 499, full: false },
  "return-received": {
    display_id: 1042,
    first_name: "Sam",
    order_url: order.order_url,
    items: [{ title: "Screen protector", quantity: 1 }],
  },
  "ready-for-collection": collection,
  "collection-reminder": collection,
  "payment-failed": { display_id: 1042, first_name: "Sam", order_url: order.order_url, total_pence: 1447 },
}
