// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"

const captureException = vi.fn()
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...a) }))

import { reportClientError } from "./report-client"

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

afterEach(() => {
  vi.unstubAllEnvs()
  captureException.mockReset()
  window.history.pushState({}, "", "/")
})

describe("reportClientError (errors caught by an error boundary)", () => {
  it("sends the error when browser monitoring is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@example.invalid/1")
    const error = new Error("render failed")
    reportClientError(error)
    await settle()
    expect(captureException).toHaveBeenCalledWith(error)
  })

  it("does nothing when monitoring is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "")
    reportClientError(new Error("render failed"))
    await settle()
    expect(captureException).not.toHaveBeenCalled()
  })

  it("never sends anything from checkout", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@example.invalid/1")
    window.history.pushState({}, "", "/checkout?step=payment")
    reportClientError(new Error("render failed"))
    await settle()
    expect(captureException).not.toHaveBeenCalled()
  })
})
