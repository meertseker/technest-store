import { test } from "node:test"
import assert from "node:assert/strict"
import { renderEmail } from "../index"
import { fixtures } from "../fixtures"

const ref = { display_id: 1042, first_name: "Sam", order_url: "https://technest.co.uk/order/order_1/confirmed" }

test("dispatched email lists items, the address and a tracking link", async () => {
  const e = await renderEmail("order-dispatched", fixtures["order-dispatched"])
  assert.equal(e.subject, "Your order #1042 is on its way")
  assert.match(e.text, /2 × USB-C to USB-C cable \(1 m, black\)/)
  assert.match(e.text, /1 High St/)
  assert.match(e.text, /RM123456789GB/)
  assert.match(e.html, /href="https:\/\/www\.royalmail\.com/)
})

test("dispatched email never links a non-http tracking url", async () => {
  const e = await renderEmail("order-dispatched", {
    ...ref,
    items: [],
    tracking: [{ number: "X1", url: "javascript:alert(1)" }],
  })
  assert.doesNotMatch(e.html, /javascript:/)
  assert.match(e.text, /X1/)
})

test("cancelled (uncollected) says the hold is released and nothing was charged", async () => {
  const e = await renderEmail("order-cancelled", fixtures["order-cancelled"])
  assert.equal(e.subject, "Your order #1042 has been cancelled")
  assert.match(e.text, /wasn't collected within 7 days/)
  assert.match(e.text, /haven't been charged/)
})

test("cancelled after capture states the refund amount and 5–10 working days", async () => {
  const e = await renderEmail("order-cancelled", { ...ref, reason: "other", payment: "refunded", refunded_pence: 1447 })
  assert.match(e.text, /£14\.47/)
  assert.match(e.text, /5–10 working days/)
})

test("refund issued states the amount and 5–10 working days", async () => {
  const e = await renderEmail("refund-issued", fixtures["refund-issued"])
  assert.equal(e.subject, "Refund of £4.99 for order #1042")
  assert.match(e.text, /£4\.99/)
  assert.match(e.text, /5–10\s+working days/)
  const full = await renderEmail("refund-issued", { ...ref, amount_pence: 1447, full: true })
  assert.match(full.text, /full order/)
})

test("return received lists the items and promises a refund within 14 days", async () => {
  const e = await renderEmail("return-received", fixtures["return-received"])
  assert.match(e.subject, /received your return/)
  assert.match(e.text, /1 × Screen protector/)
  assert.match(e.text, /14 days/)
})
