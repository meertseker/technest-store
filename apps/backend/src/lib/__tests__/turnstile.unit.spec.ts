import { MedusaContainer } from "@medusajs/framework/types"
import {
  createTurnstileVerifier,
  resolveTurnstileVerifier,
  TURNSTILE_VERIFIER_KEY,
  TURNSTILE_VERIFY_URL,
} from "../turnstile"

const respond = (body: unknown, ok = true) =>
  jest.fn(async () => ({ ok, json: async () => body }) as unknown as Response)

describe("createTurnstileVerifier", () => {
  it("posts secret, token and IP to siteverify and returns success", async () => {
    const fetchImpl = respond({ success: true })
    const verify = createTurnstileVerifier({ secret: "s3cret", fetchImpl })
    await expect(verify("tok", "203.0.113.1")).resolves.toBe(true)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(TURNSTILE_VERIFY_URL)
    expect(init.method).toBe("POST")
    const body = init.body as URLSearchParams
    expect(body.get("secret")).toBe("s3cret")
    expect(body.get("response")).toBe("tok")
    expect(body.get("remoteip")).toBe("203.0.113.1")
  })

  it("refuses a token solved for another widget (wrong action)", async () => {
    const verify = createTurnstileVerifier({
      secret: "s",
      fetchImpl: respond({ success: true, action: "newsletter", hostname: "technestlondon.co.uk" }),
      expectedAction: "repair-booking",
    })
    await expect(verify("tok")).resolves.toBe(false)
    const missing = createTurnstileVerifier({
      secret: "s",
      fetchImpl: respond({ success: true }),
      expectedAction: "repair-booking",
    })
    await expect(missing("tok")).resolves.toBe(false)
    const right = createTurnstileVerifier({
      secret: "s",
      fetchImpl: respond({ success: true, action: "repair-booking" }),
      expectedAction: "repair-booking",
    })
    await expect(right("tok")).resolves.toBe(true)
  })

  it("checks the hostname only when one is expected, and accepts the shop's subdomains", async () => {
    const solvedOn = (hostname: string | undefined) =>
      createTurnstileVerifier({
        secret: "s",
        fetchImpl: respond({ success: true, action: "repair-booking", hostname }),
        expectedAction: "repair-booking",
        expectedHostname: "technestlondon.co.uk",
      })
    await expect(solvedOn("technestlondon.co.uk")("tok")).resolves.toBe(true)
    await expect(solvedOn("www.technestlondon.co.uk")("tok")).resolves.toBe(true)
    await expect(solvedOn("evil.example")("tok")).resolves.toBe(false)
    await expect(solvedOn("nottechnestlondon.co.uk")("tok")).resolves.toBe(false)
    await expect(solvedOn(undefined)("tok")).resolves.toBe(false)

    const unchecked = createTurnstileVerifier({
      secret: "s",
      fetchImpl: respond({ success: true, action: "repair-booking", hostname: "localhost" }),
      expectedAction: "repair-booking",
    })
    await expect(unchecked("tok")).resolves.toBe(true)
  })

  it("fails closed", async () => {
    await expect(createTurnstileVerifier({ secret: "s", fetchImpl: respond({ success: false }) })("t")).resolves.toBe(false)
    await expect(createTurnstileVerifier({ secret: "s", fetchImpl: respond({}, false) })("t")).resolves.toBe(false)
    const throwing = jest.fn(async () => {
      throw new Error("network")
    }) as unknown as typeof fetch
    await expect(createTurnstileVerifier({ secret: "s", fetchImpl: throwing })("t")).resolves.toBe(false)

    const untouched = respond({ success: true })
    await expect(createTurnstileVerifier({ secret: undefined, fetchImpl: untouched })("t")).resolves.toBe(false)
    await expect(createTurnstileVerifier({ secret: "s", fetchImpl: untouched })("")).resolves.toBe(false)
    expect(untouched).not.toHaveBeenCalled()
  })
})

describe("resolveTurnstileVerifier", () => {
  const logger = { warn: jest.fn(), error: jest.fn() }
  const container = (registered: Record<string, unknown> = {}) =>
    ({
      hasRegistration: (key: string) => key in registered,
      resolve: (key: string) => registered[key],
    }) as unknown as MedusaContainer

  it("prefers a verifier registered in the container", async () => {
    const custom = jest.fn(async () => true)
    const verify = resolveTurnstileVerifier(container({ [TURNSTILE_VERIFIER_KEY]: custom }), {
      secret: "s",
      nodeEnv: "production",
    })
    expect(verify).toBe(custom)
  })

  it("bypasses only in development and test when the secret is unset", async () => {
    for (const nodeEnv of ["development", "test"]) {
      const verify = resolveTurnstileVerifier(container({ logger }), { secret: undefined, nodeEnv })
      await expect(verify("any-token")).resolves.toBe(true)
      await expect(verify("")).resolves.toBe(false)
    }
    for (const nodeEnv of ["production", "staging", undefined]) {
      const verify = resolveTurnstileVerifier(container({ logger }), { secret: "", nodeEnv })
      await expect(verify("any-token")).resolves.toBe(false)
    }
  })

  it("expects the repair-booking action, and the storefront host only in production", async () => {
    const realFetch = global.fetch
    const answer = { success: true, action: "repair-booking", hostname: "shop.example" }
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => answer })) as unknown as typeof fetch
    try {
      // Production with the storefront URL set: the host is checked.
      const prod = resolveTurnstileVerifier(container(), {
        secret: "s3cret",
        nodeEnv: "production",
        storefrontUrl: "https://technestlondon.co.uk/",
      })
      await expect(prod("tok")).resolves.toBe(false)
      answer.hostname = "technestlondon.co.uk"
      await expect(prod("tok")).resolves.toBe(true)
      answer.action = "other"
      await expect(prod("tok")).resolves.toBe(false)
      answer.action = "repair-booking"

      // Outside production, or without the URL, only the action is checked.
      answer.hostname = "localhost"
      const dev = resolveTurnstileVerifier(container(), {
        secret: "s3cret",
        nodeEnv: "development",
        storefrontUrl: "https://technestlondon.co.uk",
      })
      await expect(dev("tok")).resolves.toBe(true)
      const unset = resolveTurnstileVerifier(container(), { secret: "s3cret", nodeEnv: "production" })
      await expect(unset("tok")).resolves.toBe(true)
    } finally {
      global.fetch = realFetch
    }
  })

  it("never bypasses when a secret is set, even in test", async () => {
    const realFetch = global.fetch
    const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ success: false }) }))
    global.fetch = fetchMock as unknown as typeof fetch
    try {
      const verify = resolveTurnstileVerifier(container(), { secret: "s3cret", nodeEnv: "test" })
      await expect(verify("any-token")).resolves.toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      global.fetch = realFetch
    }
  })
})
