import { test } from "node:test"
import assert from "node:assert/strict"
import { renderEmail } from "../index"
import { fixtures } from "../fixtures"
import { todaysHours } from "../brand"

test("ready for collection has the code, address, today's hours, map link and order number", async () => {
  const e = await renderEmail("ready-for-collection", fixtures["ready-for-collection"])
  assert.equal(e.subject, "Your order #1042 is ready to collect")
  assert.match(e.text, /K7QX4M/)
  assert.match(e.text, /Unit 2A, Southwark Park Rd\., London SE16 3TU/)
  assert.match(e.text, /Today \(Saturday\): 9am–8pm/)
  assert.match(e.text, /order number \(#1042\)/)
  assert.match(e.html, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1/)
  assert.match(e.text, /until Friday 9 October/)
})

test("collection reminder says when the order will be cancelled and that nothing is charged", async () => {
  const e = await renderEmail("collection-reminder", fixtures["collection-reminder"])
  assert.match(e.subject, /Reminder: order #1042/)
  assert.match(e.text, /K7QX4M/)
  assert.match(e.text, /until Friday 9 October/)
  assert.match(e.text, /won't be charged/)
})

test("payment failed asks the customer to call and never asks for card details", async () => {
  const e = await renderEmail("payment-failed", fixtures["payment-failed"])
  assert.equal(e.subject, "We couldn't take payment for order #1042")
  assert.match(e.text, /£14\.47/)
  assert.match(e.text, /07775 669000/)
  assert.match(e.text, /never ask for card details/)
})

test("the shop copy of payment failed is flagged for staff", async () => {
  const e = await renderEmail("payment-failed", { ...fixtures["payment-failed"], for_shop: true })
  assert.match(e.subject, /FAILED: order #1042 · £14\.47/)
  assert.match(e.text, /Don't ship/)
})

test("today's hours use London time: Sunday is 11am–5pm", () => {
  // 2026-10-04 is a Sunday; 23:30 UTC on Saturday the 3rd is already Sunday 00:30 in London (BST).
  assert.equal(todaysHours(new Date("2026-10-03T23:30:00Z")), "Today (Sunday): 11am–5pm")
  assert.equal(todaysHours(new Date("2026-10-05T12:00:00Z")), "Today (Monday): 9am–8pm")
})
