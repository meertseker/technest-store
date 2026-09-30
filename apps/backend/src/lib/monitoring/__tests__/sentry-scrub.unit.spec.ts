import { scrubEvent, scrubText } from "../sentry-scrub"

describe("scrubText", () => {
  it("redacts emails, UK phone numbers, postcodes and secrets", () => {
    const out = scrubText(
      "jane.doe+x@example.co.uk called 07775 669000 / +44 7775 669000 from SE16 3TU with sk_live_abc123XYZ and whsec_9f8e and pi_3N_secret_zz"
    )
    expect(out).not.toMatch(/jane|example\.co\.uk/)
    expect(out).not.toMatch(/7775/)
    expect(out).not.toMatch(/SE16 3TU/)
    expect(out).not.toMatch(/sk_live_abc|whsec_9f8e|_secret_zz/)
    expect(out).toContain("[email]")
    expect(out).toContain("[phone]")
    expect(out).toContain("[postcode]")
    expect(out).toContain("[secret]")
  })

  it("redacts card-like digit runs", () => {
    expect(scrubText("card 4242 4242 4242 4242 ok")).toBe("card [card] ok")
  })

  it("leaves ordinary text alone", () => {
    expect(scrubText("Order order_01J9 failed at step capture-payment")).toBe(
      "Order order_01J9 failed at step capture-payment"
    )
  })
})

describe("scrubEvent", () => {
  it("drops cookies, request bodies, auth headers and user details except id", () => {
    const event: any = {
      message: "failed for bob@example.com",
      user: { id: "cus_1", email: "bob@example.com", ip_address: "1.2.3.4", username: "bob" },
      request: {
        url: "https://api.technest.co.uk/store/carts/cart_1/complete?token=abc&email=bob@example.com",
        method: "POST",
        cookies: { connect_sid: "s%3Aabc" },
        data: { email: "bob@example.com", card: "4242424242424242" },
        query_string: "token=abc&email=bob@example.com",
        headers: {
          authorization: "Bearer xyz",
          cookie: "connect_sid=abc",
          "x-publishable-api-key": "pk_123",
          "stripe-signature": "t=1,v1=abc",
          "user-agent": "Mozilla",
        },
      },
      exception: { values: [{ type: "Error", value: "No customer 07775669000" }] },
      breadcrumbs: [
        { category: "http", message: "POST /store/customers", data: { body: "{\"email\":\"a@b.co\"}", url: "/x?email=a@b.co" } },
      ],
      extra: { payload: { phone: "07775669000" } },
    }
    const out = scrubEvent(event)!
    expect(out.user).toEqual({ id: "cus_1" })
    expect(out.request.cookies).toBeUndefined()
    expect(out.request.data).toBeUndefined()
    expect(out.request.query_string).toBeUndefined()
    expect(out.request.url).toBe("https://api.technest.co.uk/store/carts/cart_1/complete")
    expect(out.request.headers).toEqual({ "user-agent": "Mozilla" })
    expect(out.message).toBe("failed for [email]")
    expect(out.exception.values[0].value).toBe("No customer [phone]")
    expect(out.breadcrumbs[0].data).toEqual({ url: "/x" })
    expect(JSON.stringify(out.extra)).not.toContain("07775669000")
  })

  it("handles minimal events", () => {
    expect(scrubEvent({ message: "hi" } as any)).toEqual({ message: "hi" })
  })
})
