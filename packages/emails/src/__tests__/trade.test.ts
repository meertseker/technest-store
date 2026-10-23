import { test } from "node:test"
import assert from "node:assert/strict"
import { renderEmail } from "../index"
import { fixtures } from "../fixtures"

test("trade application received says what happens next and when", async () => {
  const e = await renderEmail("trade-application-received", fixtures["trade-application-received"])
  assert.equal(e.subject, "We've received your trade account application")
  assert.match(e.text, /Thanks for applying for a Tech Nest trade account\./)
  assert.match(e.text, /1–2 working days/)
})

// The applicant types the company name, and the account's address is not verified:
// whatever is typed there must not reach that address inside a genuine Tech Nest email.
test("customer trade emails never show the typed company name", async () => {
  const typed = "Your account is locked, sign in at evil.example/login"
  for (const id of ["trade-application-received", "trade-application-approved", "trade-application-rejected", "trade-application-revoked"] as const) {
    const e = await renderEmail(id, { ...fixtures[id], company_name: typed } as Record<string, unknown>)
    assert.doesNotMatch(e.text + e.html, /evil\.example|account is locked/, id)
    assert.doesNotMatch(e.text + e.html, /undefined|null/, id)
  }
})

test("trade approved links to the trade account page and mentions ex-VAT prices", async () => {
  const e = await renderEmail("trade-application-approved", fixtures["trade-application-approved"])
  assert.match(e.subject, /approved/)
  assert.match(e.text, /ex VAT/)
  assert.match(e.html, /href="https:\/\/technestlondon\.co\.uk\/account\/trade"/)
})

test("trade rejected shows the staff reason and the apply-again link", async () => {
  const e = await renderEmail("trade-application-rejected", fixtures["trade-application-rejected"])
  assert.match(e.text, /Reason: We couldn't verify the VAT number/)
  assert.match(e.html, /href="https:\/\/technestlondon\.co\.uk\/trade\/apply"/)
  const none = await renderEmail("trade-application-rejected", { first_name: null })
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

test("customer-typed text can't break or flood a subject line", async () => {
  const e = await renderEmail("shop-trade-application", {
    ...fixtures["shop-trade-application"],
    company_name: "Acme\r\nBcc: victim@example.com " + "x".repeat(200),
  })
  assert.doesNotMatch(e.subject, /[\r\n]/)
  assert.ok(e.subject.length <= "New trade application: ".length + 60, e.subject)
  assert.match(e.subject, /…$/)
  const r = await renderEmail("shop-repair-booking", { ...fixtures["shop-repair-booking"], device: "Pixel\n8" })
  assert.equal(r.subject, "Repair request: Pixel 8")
})

test("shop trade application escapes customer text", async () => {
  const e = await renderEmail("shop-trade-application", {
    ...fixtures["shop-trade-application"],
    company_name: "<img src=x onerror=alert(1)>",
    contact: { name: "<b>Jane</b>", phone: "1", email: "a@b.test" },
  })
  assert.doesNotMatch(e.html, /<img src=x/)
  assert.doesNotMatch(e.html, /<b>Jane<\/b>/)
})

test("a repair phone number without digits is shown as text, not a tel: link", async () => {
  const e = await renderEmail("shop-repair-booking", { ...fixtures["shop-repair-booking"], phone: "call me" })
  assert.doesNotMatch(e.html, /href="tel:/)
  assert.match(e.text, /Phone: call me/)
})

test("trade revoked is short, shows the staff reason when there is one, and says they may apply again", async () => {
  const e = await renderEmail("trade-application-revoked", fixtures["trade-application-revoked"])
  assert.equal(e.subject, "Your Tech Nest trade account has been closed")
  assert.match(e.text, /no longer has a trade account/)
  assert.match(e.text, /Reason: The business has stopped trading\./)
  assert.match(e.text, /apply again/)
  assert.match(e.html, /href="https:\/\/technestlondon\.co\.uk\/trade\/apply"/)
  assert.ok(e.text.split("\n").filter((l) => l.trim()).length <= 14, "stays short")
  const none = await renderEmail("trade-application-revoked", { first_name: null })
  assert.doesNotMatch(none.text, /Reason:/)
  assert.doesNotMatch(none.text + none.html, /undefined|null/)
})
