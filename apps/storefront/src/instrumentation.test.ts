import { afterEach, describe, expect, it, vi } from "vitest"

const { init, captureRequestError, loaded } = vi.hoisted(() => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
  loaded: vi.fn(),
}))
vi.mock("@sentry/nextjs", () => {
  loaded()
  return { init, captureRequestError }
})

describe("storefront server Sentry (instrumentation.ts)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("is a no-op without SENTRY_DSN: the SDK is never loaded", async () => {
    vi.stubEnv("SENTRY_DSN", "")
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    const { register, onRequestError } = await import("./instrumentation")
    await register()
    await onRequestError(
      new Error("x"),
      { path: "/", method: "GET", headers: {} },
      { routerKind: "App Router", routePath: "/", routeType: "render", renderSource: "react-server-components", revalidateReason: undefined }
    )
    expect(loaded).not.toHaveBeenCalled()
    expect(init).not.toHaveBeenCalled()
    expect(captureRequestError).not.toHaveBeenCalled()
  })

  it("inits with scrubbing hooks and no tracing when SENTRY_DSN is set", async () => {
    vi.stubEnv("SENTRY_DSN", "https://public@o0.ingest.sentry.io/0")
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    const { register } = await import("./instrumentation")
    await register()
    expect(init).toHaveBeenCalledTimes(1)
    const options = init.mock.calls[0][0]
    expect(options.tracesSampleRate).toBeUndefined()
    expect(options.dataCollection.userInfo).toBe(false)
    expect(options.beforeSend({ message: "a@b.co", user: { id: "c", email: "a@b.co" } })).toEqual({
      message: "[email]",
      user: { id: "c" },
    })
  })
})
