import { test } from "node:test"
import assert from "node:assert/strict"
import { renderEmail } from "../index"

const url = "https://technest.co.uk/account/reset-password?token=abc.def&email=sam%40example.com"

test("password reset links to the reset page and says it expires in 15 minutes", async () => {
  const e = await renderEmail("password-reset", { reset_url: url, actor: "customer" })
  assert.equal(e.subject, "Reset your Tech Nest password")
  assert.match(e.html, /href="https:\/\/technest\.co\.uk\/account\/reset-password\?token=abc\.def&amp;email=sam%40example\.com"/)
  assert.ok(e.text.includes(url))
  assert.match(e.text, /15 minutes/)
  assert.match(e.text, /didn't ask/i)
})

test("staff password reset is labelled for the shop admin", async () => {
  const e = await renderEmail("password-reset", {
    reset_url: "https://admin.technest.co.uk/app/reset-password?token=t",
    actor: "staff",
  })
  assert.match(e.subject, /admin/i)
})

test("password reset refuses a non-https link outside localhost", async () => {
  await assert.rejects(
    renderEmail("password-reset", { reset_url: "javascript:alert(1)", actor: "customer" }),
    /reset_url/
  )
})
