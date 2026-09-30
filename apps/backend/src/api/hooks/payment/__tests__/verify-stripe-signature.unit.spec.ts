import { createRequire } from "module"
import { isValidStripeSignature } from "../verify-stripe-signature"

// Stripe's own library (the version the provider uses) generates the headers,
// so our check is pinned to Stripe's real scheme, offline.
const Stripe = createRequire(require.resolve("@medusajs/payment-stripe/package.json"))("stripe")
const secret = "whsec_unit_test"
const body = '{"id":"evt_1", "type":"payment_intent.succeeded"}'
const now = Math.floor(Date.now() / 1000)
const sign = (payload: string, opts: Record<string, unknown> = {}) =>
  Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: now, ...opts }) as string

describe("isValidStripeSignature", () => {
  it("accepts a header Stripe's library signed over the raw body (string or Buffer)", () => {
    const header = sign(body)
    expect(isValidStripeSignature(body, header, secret, now)).toBe(true)
    expect(isValidStripeSignature(Buffer.from(body), header, secret, now)).toBe(true)
    // Stripe's own verifier agrees.
    expect(() => Stripe.webhooks.constructEvent(body, header, secret)).not.toThrow()
  })

  it("accepts when any of several v1 signatures matches (secret rotation)", () => {
    const good = sign(body).split(",").find((p) => p.startsWith("v1="))
    const header = `t=${now},v1=${"0".repeat(64)},${good}`
    expect(isValidStripeSignature(body, header, secret, now)).toBe(true)
  })

  it.each([
    ["a re-serialised body", () => [JSON.stringify(JSON.parse(body)), sign(body)]],
    ["a tampered body", () => [body.replace("evt_1", "evt_2"), sign(body)]],
    ["another secret", () => [body, sign(body, { secret: "whsec_other" })]],
    ["a missing header", () => [body, undefined]],
    ["a header without v1", () => [body, `t=${now}`]],
    ["a header without t", () => [body, sign(body).replace(/t=\d+,/, "")]],
    ["garbage", () => [body, "nonsense"]],
    ["non-hex signature", () => [body, `t=${now},v1=zz`]],
  ])("rejects %s", (_name, make) => {
    const [payload, header] = make() as [string, string | undefined]
    expect(isValidStripeSignature(payload, header, secret, now)).toBe(false)
  })

  it("rejects replays outside the 5 minute tolerance", () => {
    const header = sign(body, { timestamp: now - 301 })
    expect(isValidStripeSignature(body, header, secret, now)).toBe(false)
    expect(isValidStripeSignature(body, sign(body, { timestamp: now - 299 }), secret, now)).toBe(true)
  })

  it("rejects everything when no secret is configured", () => {
    expect(isValidStripeSignature(body, sign(body), "", now)).toBe(false)
  })
})
