// The scrubber is shared with the backend (identical file, checked by the backend unit test,
// which also has the full per-category suite). These cases cover the storefront's own data.
import { describe, expect, it } from "vitest"
import { FILTERED, scrubBreadcrumb, scrubEvent, scrubText } from "./sentry-scrub"

describe("scrubText", () => {
  it("redacts each PII / secret category", () => {
    const cases: [string, string][] = [
      ["a.b@example.com", "[email]"],
      ["07775 669000", "[phone]"],
      ["SE16 3TU", "[postcode]"],
      ["4242 4242 4242 4242", "[card]"],
      ["pi_1Abc_secret_x9", "[secret]"],
      ["sk_test_51Habc123", "[secret]"],
      ["Bearer abc.def", "Bearer [secret]"],
      ["/account/reset?token=abc", `/account/reset?token=${FILTERED}`],
      ['{"first_name":"Jane"}', `{"first_name":"${FILTERED}"}`],
      ['{"address_1":"1 Road"}', `{"address_1":"${FILTERED}"}`],
      ["_medusa_jwt=abc", `_medusa_jwt=${FILTERED}`],
    ]
    for (const [input, expected] of cases) {
      expect(scrubText(input)).toBe(expected)
    }
  })
})

describe("scrubEvent", () => {
  it("keeps only the user id and strips cookies, bodies, headers and query strings", () => {
    const out = scrubEvent({
      user: { id: "cus_1", email: "x@y.co" },
      request: {
        url: "https://technest.co.uk/account?email=x@y.co",
        cookies: { a: "b" },
        data: "{}",
        headers: { Cookie: "_medusa_jwt=abc", "User-Agent": "Mozilla" },
      },
    })
    expect(out.user).toEqual({ id: "cus_1" })
    expect(out.request).toEqual({ url: "https://technest.co.uk/account", headers: { "User-Agent": "Mozilla" } })
  })
})

describe("scrubBreadcrumb", () => {
  it("strips query strings from client-side navigation breadcrumbs", () => {
    expect(scrubBreadcrumb({ category: "navigation", data: { from: "/cart?x=1", to: "/account?token=t" } }).data).toEqual({
      from: "/cart",
      to: "/account",
    })
  })
})
