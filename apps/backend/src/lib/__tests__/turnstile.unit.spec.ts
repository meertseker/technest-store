import { createTurnstileVerifier, TURNSTILE_VERIFY_URL } from "../turnstile"

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
