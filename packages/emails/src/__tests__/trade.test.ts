import { test } from "node:test"
import assert from "node:assert/strict"
import { renderEmail } from "../index"
import { fixtures } from "../fixtures"

test("trade application received names the company and the wait", async () => {
  const e = await renderEmail("trade-application-received", fixtures["trade-application-received"])
  assert.equal(e.subject, "We've received your trade account application")
  assert.match(e.text, /Acme Phones Ltd/)
  assert.match(e.text, /1–2 working days/)
})

test("trade approved links to the trade account page and mentions ex-VAT prices", async () => {
  const e = await renderEmail("trade-application-approved", fixtures["trade-application-approved"])
  assert.match(e.subject, /approved/)
  assert.match(e.text, /ex VAT/)
  assert.match(e.html, /href="https:\/\/technest\.co\.uk\/account\/trade"/)
})

test("trade rejected shows the staff reason and the apply-again link", async () => {
  const e = await renderEmail("trade-application-rejected", fixtures["trade-application-rejected"])
  assert.match(e.text, /Reason: We couldn't verify the VAT number/)
  assert.match(e.html, /href="https:\/\/technest\.co\.uk\/trade\/apply"/)
  const none = await renderEmail("trade-application-rejected", { first_name: null, company_name: "X" })
  assert.doesNotMatch(none.text, /Reason:/)
})

test("shop trade application lists the business details", async () => {
  const e = await renderEmail("shop-trade-application", fixtures["shop-trade-application"])
  assert.equal(e.subject, "New trade application: Acme Phones Ltd")
  for (const s of ["limited company", "GB123456789", "01234567", "Jane Smith", "020 7946 0000", "jane@acme.test"]) {
    assert.ok(e.text.includes(s), s)
  }
})

test("shop repair booking has a tap-to-call link and every field", async () => {
  const e = await renderEmail("shop-repair-booking", fixtures["shop-repair-booking"])
  assert.equal(e.subject, "Repair request: iPhone 13 mini")
  assert.match(e.html, /href="tel:07700900123"/)
  for (const s of ["Sam Jones", "sam@example.com", "Cracked screen", "Weekday mornings"]) {
    assert.ok(e.text.includes(s), s)
  }
})

test("shop repair booking escapes customer text", async () => {
  const e = await renderEmail("shop-repair-booking", {
    ...fixtures["shop-repair-booking"],
    fault: "<script>alert(1)</script>",
    phone: "javascript:alert(1)",
  })
  assert.doesNotMatch(e.html, /<script>/)
  assert.doesNotMatch(e.html, /href="javascript/)
})

test("low stock digest counts items and shows what's left", async () => {
  const e = await renderEmail("shop-low-stock-digest", fixtures["shop-low-stock-digest"])
  assert.equal(e.subject, "Low stock: 2 items to reorder (Monday 5 October)")
  assert.match(e.text, /USB-C to USB-C cable \(1 m, black\) · CAB-CC-1M-BLK/)
  assert.match(e.text, /2 left \(min 5\)/)
  assert.match(e.text, /0 left \(min 3\)/)
})
