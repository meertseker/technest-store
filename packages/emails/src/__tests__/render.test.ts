import { test } from "node:test"
import assert from "node:assert/strict"
import { renderEmail } from "../index"

test("welcome renders subject, branded HTML and a plain-text version", async () => {
  const email = await renderEmail("welcome", { first_name: "Sam" })

  assert.equal(email.subject, "Welcome to Tech Nest")
  assert.match(email.html, /#D6001C/i)
  assert.match(email.html, /Hi Sam/)
  assert.match(email.html, /Unit 2A, Southwark Park Rd\., London SE16 3TU/)
  assert.match(email.html, /07775 669000/)
  assert.match(email.html, /href="https:\/\/technest\.co\.uk\/returns"/)

  assert.match(email.text, /Hi Sam/)
  assert.match(email.text, /Unit 2A, Southwark Park Rd\., London SE16 3TU/)
  assert.doesNotMatch(email.text, /<[a-z]/i)
})

test("unknown template rejects with its id", async () => {
  await assert.rejects(renderEmail("does-not-exist" as any, {}), /does-not-exist/)
})

test("every template has preview fixture data and renders with it", async () => {
  const { templateIds } = await import("../index")
  const { fixtures } = await import("../fixtures")
  for (const id of templateIds) {
    assert.ok(fixtures[id], `missing fixture for ${id}`)
    const email = await renderEmail(id, fixtures[id])
    assert.ok(email.subject && email.html && email.text, `empty render for ${id}`)
  }
})
