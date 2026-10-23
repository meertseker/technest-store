import { test } from "node:test"
import assert from "node:assert/strict"
import { renderEmail } from "../index"
import { fixtures } from "../fixtures"

const admin = "https://admin.technestlondon.co.uk/app/orders/order_1"

test("dispute email leads with the deadline, the Stripe link and the no-refund warning", async () => {
  const e = await renderEmail("shop-payment-dispute", fixtures["shop-payment-dispute"])
  assert.equal(e.subject, "Chargeback on order #1042: £14.47, respond by Friday 24 October")
  assert.match(e.text, /disputed £14\.47 of order #1042/)
  assert.match(e.text, /by Friday 24 October/)
  assert.match(e.text, /Reason given: fraudulent/)
  assert.match(e.text, /Don't refund this order from the admin/)
  assert.match(e.html, /href="https:\/\/dashboard\.stripe\.com\/test\/disputes\/dp_example"/)
  assert.match(e.html, new RegExp(`href="${admin}"`))
})

test("dispute email without a deadline still asks for evidence", async () => {
  const e = await renderEmail("shop-payment-dispute", { ...fixtures["shop-payment-dispute"], due_by: null })
  assert.equal(e.subject, "Chargeback on order #1042: £14.47")
  assert.match(e.text, /Check the response deadline/)
  assert.doesNotMatch(e.text, /Respond by/)
})

test("external refund notice says it was recorded and the customer emailed", async () => {
  const e = await renderEmail("shop-payment-notice", fixtures["shop-payment-notice"])
  assert.equal(e.subject, "Refund of £4.99 made in Stripe, not the admin: order #1042")
  assert.match(e.text, /refunded in the Stripe dashboard/)
  assert.match(e.text, /customer has been emailed/)
  assert.match(e.html, new RegExp(`href="${admin}"`))

  const unrecorded = await renderEmail("shop-payment-notice", { ...fixtures["shop-payment-notice"], unrecorded: true })
  assert.match(unrecorded.text, /could not be written to the order/)
  assert.doesNotMatch(unrecorded.text, /customer has been emailed/)
})

test("hold released notice names the reason and says not to ship", async () => {
  const e = await renderEmail("shop-payment-notice", {
    kind: "hold_released",
    display_id: 1042,
    amount_pence: 998,
    reason: "requested_by_customer",
    admin_order_url: admin,
  })
  assert.equal(e.subject, "Card hold released at Stripe: order #1042 can't be charged")
  assert.match(e.text, /\(reason: requested_by_customer\)/)
  assert.match(e.text, /cannot be captured/)
  assert.match(e.text, /Don't ship or hand over/)
  const noReason = await renderEmail("shop-payment-notice", {
    kind: "hold_released",
    display_id: 1042,
    amount_pence: 998,
    reason: null,
    admin_order_url: admin,
  })
  assert.doesNotMatch(noReason.text, /reason:/)
})

test("handed over outside the board notice points staff to the board", async () => {
  const e = await renderEmail("shop-payment-notice", {
    kind: "collected_outside_board",
    display_id: 1042,
    amount_pence: 998,
    admin_order_url: admin,
  })
  assert.equal(e.subject, "Order #1042 was handed over outside the Click & Collect board")
  assert.match(e.text, /payment of £9\.98 has now been taken/)
  assert.match(e.text, /use the Click & Collect board/)
})
