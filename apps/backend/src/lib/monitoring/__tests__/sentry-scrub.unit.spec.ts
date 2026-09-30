import { readFileSync } from "fs"
import path from "path"
import {
  FILTERED,
  SENTRY_DATA_COLLECTION,
  isSensitiveKey,
  scrubBreadcrumb,
  scrubEvent,
  scrubText,
  scrubValue,
} from "../sentry-scrub"

describe("scrubText: one test per PII / secret category", () => {
  it("emails", () => {
    const out = scrubText("no customer jane.doe+x@example.co.uk")
    expect(out).toBe("no customer [email]")
  })

  it("names and addresses in serialised payloads", () => {
    const out = scrubText(
      'invalid address {"first_name":"Jane","last_name":"Doe","address_1":"2A Southwark Park Rd","city":"London","company":"Acme"}'
    )
    for (const pii of ["Jane", "Doe", "Southwark", "London", "Acme"]) {
      expect(out).not.toContain(pii)
    }
    expect(out).toContain(`"first_name":"${FILTERED}"`)
    expect(scrubText("first_name=Jane last_name=Doe")).toBe(
      `first_name="${FILTERED}" last_name="${FILTERED}"`
    )
  })

  it("UK and international phone numbers", () => {
    for (const phone of [
      "07775 669000",
      "07775669000",
      "+44 7775 669000",
      "+44 (0)20 7946 0018",
      "020 7946 0018",
      "0044 7775 669000",
      "+90 532 123 4567",
    ]) {
      expect(scrubText(`call ${phone} now`)).toBe("call [phone] now")
    }
  })

  it("UK postcodes", () => {
    expect(scrubText("deliver to SE16 3TU")).toBe("deliver to [postcode]")
    expect(scrubText("deliver to w1a1aa")).toBe("deliver to [postcode]")
  })

  it("card numbers (Luhn-valid only) and card fields", () => {
    expect(scrubText("card 4242 4242 4242 4242 ok")).toBe("card [card] ok")
    expect(scrubText("card 4000-0025-0000-3155")).toBe("card [card]")
    expect(scrubText("pan 378282246310005")).toBe("pan [card]")
    // A 13-digit timestamp is not a card number.
    expect(scrubText("at 1727650000001")).toBe("at 1727650000001")
    expect(scrubText('{"cvc":"123","exp_month":12,"number":"4242424242424242"}')).not.toMatch(/123|4242/)
  })

  it("Stripe secret keys, webhook secrets and client secrets", () => {
    const out = scrubText(
      "sk_live_51Habc123XYZ rk_test_51Habc987 whsec_9f8eAbC pi_3N1abc_secret_zz9 seti_1Nabc_secret_Q1 cs_live_a1B2c3"
    )
    expect(out).toBe("[secret] [secret] [secret] [secret] [secret] [secret]")
  })

  it("auth headers, bearer tokens and JWTs", () => {
    expect(scrubText("Authorization: Bearer abc.def-123")).not.toContain("abc.def-123")
    expect(scrubText("Basic dXNlcjpwYXNz")).toBe("Basic [secret]")
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXNfMSJ9.sig-nature_1"
    expect(scrubText(`token ${jwt}`)).toBe("token [secret]")
  })

  it("cookies", () => {
    const out = scrubText("cookie: connect.sid=s%3Aabc.def; _medusa_jwt=xyz; __stripe_mid=m1")
    expect(out).not.toMatch(/s%3Aabc|xyz|m1\b/)
  })

  it("query strings with tokens, emails and other values", () => {
    const out = scrubText(
      "GET https://technest.co.uk/reset-password?token=abc123&email=bob@example.com&x=1"
    )
    expect(out).toBe(
      `GET https://technest.co.uk/reset-password?token=${FILTERED}&email=${FILTERED}&x=${FILTERED}`
    )
  })

  it("IP addresses", () => {
    expect(scrubText("from 203.0.113.9")).toBe("from [ip]")
  })

  it("truncates very long strings before scrubbing", () => {
    const out = scrubText("a".repeat(20000) + " bob@example.com")
    expect(out.length).toBeLessThan(8300)
    expect(out.endsWith("...[truncated]")).toBe(true)
  })

  it("leaves ordinary operational text alone", () => {
    const text =
      "Order order_01J9ZK3 failed at step capture-payment after 3 retries (2026-09-30T03:15:00Z)"
    expect(scrubText(text)).toBe(text)
  })
})

describe("isSensitiveKey / scrubValue", () => {
  it("filters values under sensitive keys, whatever the value", () => {
    for (const key of [
      "email",
      "first_name",
      "lastName",
      "phone",
      "address_1",
      "shipping_address",
      "postal_code",
      "city",
      "company",
      "card",
      "cvc",
      "client_secret",
      "password",
      "authorization",
      "cookie",
      "ip_address",
    ]) {
      expect(isSensitiveKey(key)).toBe(true)
    }
    for (const key of ["id", "status", "step", "currency_code", "quantity"]) {
      expect(isSensitiveKey(key)).toBe(false)
    }
  })

  it("recurses into nested data", () => {
    const out = scrubValue({
      cart: {
        id: "cart_1",
        shipping_address: { address_1: "1 Road", postal_code: "SE16 3TU" },
        items: [{ title: "Cable", note: "ring 07775669000" }],
      },
    })
    expect(out).toEqual({
      cart: { id: "cart_1", shipping_address: FILTERED, items: [{ title: "Cable", note: "ring [phone]" }] },
    })
  })
})

describe("scrubEvent", () => {
  it("drops cookies, bodies, query strings, env, disallowed headers and user details except id", () => {
    const event = {
      message: "failed for bob@example.com",
      transaction: "POST /store/carts?email=bob@example.com",
      user: { id: "cus_1", email: "bob@example.com", ip_address: "1.2.3.4", username: "bob" },
      request: {
        url: "https://api.technest.co.uk/store/carts/cart_1/complete?token=abc&email=bob@example.com",
        method: "POST",
        cookies: { connect_sid: "s%3Aabc" },
        data: { email: "bob@example.com", card: "4242424242424242" },
        query_string: "token=abc&email=bob@example.com",
        env: { REMOTE_ADDR: "1.2.3.4" },
        headers: {
          authorization: "Bearer xyz",
          Cookie: "connect_sid=abc",
          "x-publishable-api-key": "pk_123",
          "stripe-signature": "t=1,v1=abc",
          "x-forwarded-for": "1.2.3.4",
          "cf-connecting-ip": "1.2.3.4",
          referer: "https://technest.co.uk/account?email=bob@example.com",
          "user-agent": "Mozilla",
        },
      },
      exception: {
        values: [
          {
            type: "Error",
            value: "No customer 07775669000",
            stacktrace: {
              frames: [{ function: "f", vars: { email: "bob@example.com", pin: "1234" } }],
            },
          },
        ],
      },
      breadcrumbs: [
        {
          category: "http",
          message: "POST /store/customers",
          data: {
            body: '{"email":"a@b.co"}',
            url: "/x?email=a@b.co",
            "http.query": "email=a@b.co",
            status_code: 500,
          },
        },
      ],
      extra: { payload: { phone: "07775669000", step: "create-customer" } },
      contexts: { customer: { first_name: "Jane" } },
      tags: { postcode: "SE16 3TU" },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = scrubEvent(event) as any
    expect(out.user).toEqual({ id: "cus_1" })
    expect(out.request).toEqual({
      url: "https://api.technest.co.uk/store/carts/cart_1/complete",
      method: "POST",
      headers: { "user-agent": "Mozilla" },
    })
    expect(out.transaction).toBe("POST /store/carts")
    expect(out.message).toBe("failed for [email]")
    expect(out.exception.values[0].value).toBe("No customer [phone]")
    expect(out.exception.values[0].stacktrace.frames[0]).toEqual({ function: "f" })
    expect(out.breadcrumbs[0].data).toEqual({ url: "/x", status_code: 500 })
    expect(out.extra).toEqual({ payload: { phone: FILTERED, step: "create-customer" } })
    expect(out.contexts).toEqual({ customer: { first_name: FILTERED } })
    expect(out.tags).toEqual({ postcode: FILTERED })
    const json = JSON.stringify(out)
    for (const pii of ["bob", "a@b.co", "07775669000", "Jane", "SE16", "1.2.3.4", "xyz", "pk_123", "abc"]) {
      expect(json).not.toContain(pii)
    }
  })

  it("drops users without an id and handles minimal events", () => {
    expect(scrubEvent({ message: "hi", user: { email: "x@y.co" } })).toEqual({ message: "hi" })
    expect(scrubEvent({ message: "hi" })).toEqual({ message: "hi" })
  })

  it("scrubs logentry params and thread stack variables", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = scrubEvent({
      logentry: { message: "user %s", params: ["bob@example.com"] },
      threads: { values: [{ id: 1, stacktrace: { frames: [{ vars: { a: 1 } }] } }] },
    }) as any
    expect(out.logentry).toEqual({ message: "user %s", params: ["[email]"] })
    expect(out.threads.values[0].stacktrace.frames[0]).toEqual({})
  })
})

describe("scrubBreadcrumb", () => {
  it("strips query strings and fragments from navigation URLs and scrubs console messages", () => {
    const nav = scrubBreadcrumb({
      data: { from: "/account?token=a#x", to: "/order/confirmed?email=b@c.co" },
    })
    expect(nav.data).toEqual({ from: "/account", to: "/order/confirmed" })
    const log = scrubBreadcrumb({ message: "saved address for jane@x.co, SE16 3TU" })
    expect(log.message).toBe("saved address for [email], [postcode]")
  })
})

describe("SENTRY_DATA_COLLECTION", () => {
  it("collects nothing personal at the source", () => {
    expect(SENTRY_DATA_COLLECTION).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      databaseQueryData: false,
    })
  })
})

describe("storefront copy", () => {
  it("is identical to apps/storefront/src/lib/monitoring/sentry-scrub.ts", () => {
    const backend = readFileSync(path.join(__dirname, "..", "sentry-scrub.ts"), "utf8")
    const storefront = readFileSync(
      path.join(__dirname, "../../../../../storefront/src/lib/monitoring/sentry-scrub.ts"),
      "utf8"
    )
    expect(storefront).toBe(backend)
  })
})
