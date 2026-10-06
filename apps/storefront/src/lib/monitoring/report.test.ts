import { afterEach, describe, expect, it, vi } from "vitest"

const captureException = vi.fn()
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...a) }))

import { isUnexpected, reportError, reportUnexpected } from "./report"

const withStatus = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status })

afterEach(() => {
  vi.unstubAllEnvs()
  captureException.mockReset()
})

describe("reportError", () => {
  it("does nothing when monitoring is not configured", async () => {
    vi.stubEnv("SENTRY_DSN", "")
    await reportError(new Error("boom"), "test")
    expect(captureException).not.toHaveBeenCalled()
  })

  it("sends the error, tagged with where it was handled", async () => {
    vi.stubEnv("SENTRY_DSN", "https://key@example.invalid/1")
    const error = new Error("boom")
    await reportError(error, "account.save-address")
    expect(captureException).toHaveBeenCalledWith(error, { tags: { handled_in: "account.save-address" } })
  })

  it("never throws, even if the monitoring client does", async () => {
    vi.stubEnv("SENTRY_DSN", "https://key@example.invalid/1")
    captureException.mockImplementation(() => {
      throw new Error("sentry down")
    })
    await expect(reportError(new Error("boom"), "test")).resolves.toBeUndefined()
  })
})

describe("what counts as unexpected", () => {
  it.each([400, 401, 403, 404, 409, 422, 429])("a %i is an ordinary refusal", (status) => {
    expect(isUnexpected(withStatus(status))).toBe(false)
  })

  it.each([500, 502, 503, 504])("a %i is unexpected", (status) => {
    expect(isUnexpected(withStatus(status))).toBe(true)
  })

  it("a timeout, a network failure or a bug is unexpected", () => {
    expect(isUnexpected(Object.assign(new Error("timed out"), { name: "TimeoutError" }))).toBe(true)
    expect(isUnexpected(new TypeError("fetch failed"))).toBe(true)
    expect(isUnexpected("boom")).toBe(true)
  })

  it("reportUnexpected skips ordinary refusals", async () => {
    vi.stubEnv("SENTRY_DSN", "https://key@example.invalid/1")
    await reportUnexpected(withStatus(401), "test")
    expect(captureException).not.toHaveBeenCalled()
    await reportUnexpected(withStatus(503), "test")
    expect(captureException).toHaveBeenCalledTimes(1)
  })
})
