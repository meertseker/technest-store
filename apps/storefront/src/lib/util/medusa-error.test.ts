import { describe, expect, it } from "vitest"
import medusaError from "./medusa-error"

const thrownBy = (error: unknown) => {
  try {
    medusaError(error)
  } catch (e) {
    return e as Error & { status?: number }
  }
  throw new Error("medusaError returned")
}

// The Medusa JS SDK throws a FetchError: `message` is the backend's own text,
// `status` the HTTP status, `statusText` the reason phrase. There is no `response`.
const sdkError = (status: number, message: string, statusText = "Bad Request") =>
  Object.assign(new Error(message), { status, statusText })

describe("medusaError (the SDK's FetchError shape)", () => {
  it("keeps the backend's message, capitalised and with a full stop, and the status", () => {
    const e = thrownBy(sdkError(400, "postal code is required"))
    expect(e.message).toBe("Postal code is required.")
    expect(e.status).toBe(400)
  })

  it("does not double the full stop or add a technical prefix", () => {
    const e = thrownBy(sdkError(401, "This email belongs to a trade account. Sign in to use it."))
    expect(e.message).toBe("This email belongs to a trade account. Sign in to use it.")
    expect(e.message).not.toMatch(/^Error setting up/)
  })

  it("falls back to the reason phrase, then to a plain sentence, when there is no message", () => {
    expect(thrownBy(sdkError(502, "", "Bad Gateway")).message).toBe("Bad Gateway.")
    expect(thrownBy(Object.assign(new Error(""), { status: 500 })).message).toBe("The request failed.")
  })

  it("passes a plain Error through with its message and no status", () => {
    const e = thrownBy(new TypeError("fetch failed"))
    expect(e.message).toBe("Fetch failed.")
    expect(e.status).toBeUndefined()
  })

  it("copes with things that are not errors at all", () => {
    expect(thrownBy("boom").message).toBe("Boom.")
    expect(thrownBy(null).message).toBe("The request failed.")
    expect(thrownBy({ status: 404 }).status).toBe(404)
  })
})
