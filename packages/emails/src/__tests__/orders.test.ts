import { test } from "node:test"
import assert from "node:assert/strict"
import { renderEmail } from "../index"
import type { OrderEmailData } from "../order-types"

const delivery: OrderEmailData = {
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

const collection: OrderEmailData = {
  ...delivery,
  shipping_total_pence: 0,
  total_pence: 1098,
  fulfilment: { type: "collection", method_name: "Click & Collect" },
  shipping_address: null,
}

test("order confirmation lists items and VAT-inclusive totals in GBP", async () => {
  const e = await renderEmail("order-confirmation", delivery)
  assert.equal(e.subject, "Order confirmed: #1042")
  for (const body of [e.html, e.text]) {
    assert.match(body, /USB-C to USB-C cable/)
    assert.match(body, /1 m, black/)
    assert.match(body, /£9\.98/)
    assert.match(body, /£3\.49/)
    assert.match(body, /£14\.47/)
    assert.match(body, /includes VAT of £2\.41/i)
  }
})

test("order confirmation states the delivery choice and address", async () => {
  const e = await renderEmail("order-confirmation", delivery)
  assert.match(e.text, /Standard delivery/)
  assert.match(e.text, /1 High St/)
})

test("order confirmation for Click & Collect says where and to bring the order number", async () => {
  const e = await renderEmail("order-confirmation", collection)
  assert.match(e.text, /Click & Collect/)
  assert.match(e.text, /Unit 2A, Southwark Park Rd\., London SE16 3TU/)
  assert.match(e.text, /ready for collection/i)
  assert.match(e.text, /order number/i)
})

test("order confirmation includes the 14-day right to cancel", async () => {
  const e = await renderEmail("order-confirmation", delivery)
  assert.match(e.text, /14 days/)
  assert.match(e.text, /cancel/i)
})

test("shop alert flags Click & Collect in the subject", async () => {
  const c = await renderEmail("shop-new-order", collection)
  const d = await renderEmail("shop-new-order", delivery)
  assert.equal(c.subject, "New order #1042 · CLICK & COLLECT · £10.98")
  assert.equal(d.subject, "New order #1042 · Delivery · £14.47")
  assert.match(c.text, /USB-C to USB-C cable/)
})

test("customer-controlled text is escaped in HTML", async () => {
  const e = await renderEmail("order-confirmation", {
    ...delivery,
    first_name: "<img src=x onerror=alert(1)>",
  })
  assert.doesNotMatch(e.html, /<img src=x/)
})
