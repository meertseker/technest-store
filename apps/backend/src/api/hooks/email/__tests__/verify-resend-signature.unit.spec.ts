import { createHmac, randomBytes } from "node:crypto"
import { isValidSvixSignature, RESEND_SIGNATURE_TOLERANCE_SECONDS } from "../verify-resend-signature"

// Svix's documented scheme (docs.svix.com/receiving/verifying-payloads/how-manual):
// HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${body}` with the base64 key after
// "whsec_", base64 output, header "v1,<sig>" entries separated by spaces.
const key = randomBytes(24)
const secret = `whsec_${key.toString("base64")}`
const body = '{"type":"email.bounced","data":{"email_id":"em_1"}}'
const id = "msg_2abc"
const now = 1_760_000_000
const sign = (payload: string, ts = now, k = key) =>
  "v1," + createHmac("sha256", k).update(`${id}.${ts}.${payload}`).digest("base64")

const headers = (over: Record<string, string | undefined> = {}) => ({
  "svix-id": id,
  "svix-timestamp": String(now),
  "svix-signature": sign(body),
  ...over,
})

describe("isValidSvixSignature", () => {
  it("accepts a correctly signed raw body (string or Buffer)", () => {
    expect(isValidSvixSignature(body, headers(), secret, now)).toBe(true)
    expect(isValidSvixSignature(Buffer.from(body), headers(), secret, now)).toBe(true)
  })

  it("accepts when any of several space-separated signatures matches (key rotation)", () => {
    const other = sign(body, now, randomBytes(24))
    expect(isValidSvixSignature(body, headers({ "svix-signature": `${other} ${sign(body)}` }), secret, now)).toBe(true)
  })

  it.each([
    ["a re-serialised body", () => [body.replace(":", ": "), headers()]],
    ["a tampered body", () => [body.replace("em_1", "em_2"), headers()]],
    ["another secret", () => [body, headers({ "svix-signature": sign(body, now, randomBytes(24)) })]],
    ["a changed id", () => [body, headers({ "svix-id": "msg_other" })]],
    ["a changed timestamp", () => [body, headers({ "svix-timestamp": String(now + 1) })]],
    ["a missing signature", () => [body, headers({ "svix-signature": undefined })]],
    ["a missing id", () => [body, headers({ "svix-id": undefined })]],
    ["a missing timestamp", () => [body, headers({ "svix-timestamp": undefined })]],
    ["an unversioned signature", () => [body, headers({ "svix-signature": sign(body).slice(3) })]],
    ["garbage", () => [body, headers({ "svix-signature": "v1,nonsense" })]],
  ])("rejects %s", (_name, make) => {
    const [payload, h] = make() as [string, Record<string, string | undefined>]
    expect(isValidSvixSignature(payload, h, secret, now)).toBe(false)
  })

  it("rejects timestamps outside the five-minute window, either way", () => {
    expect(RESEND_SIGNATURE_TOLERANCE_SECONDS).toBe(300)
    const old = now - 301
    expect(
      isValidSvixSignature(body, headers({ "svix-timestamp": String(old), "svix-signature": sign(body, old) }), secret, now)
    ).toBe(false)
    const future = now + 301
    expect(
      isValidSvixSignature(
        body,
        headers({ "svix-timestamp": String(future), "svix-signature": sign(body, future) }),
        secret,
        now
      )
    ).toBe(false)
    const edge = now - 299
    expect(
      isValidSvixSignature(body, headers({ "svix-timestamp": String(edge), "svix-signature": sign(body, edge) }), secret, now)
    ).toBe(true)
  })

  it("rejects everything when the secret is empty or malformed", () => {
    expect(isValidSvixSignature(body, headers(), "", now)).toBe(false)
    expect(isValidSvixSignature(body, headers(), "not-a-secret", now)).toBe(false)
  })
})
