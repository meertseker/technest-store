/**
 * Sentry must be a no-op without SENTRY_DSN: the SDK is not even loaded.
 * With a DSN it is initialised with our PII settings and scrubbers.
 */
import { SENTRY_DATA_COLLECTION } from "../sentry-scrub"

describe("backend Sentry init (instrumentation.ts)", () => {
  const original = process.env.SENTRY_DSN
  afterEach(() => {
    if (original === undefined) {
      delete process.env.SENTRY_DSN
    } else {
      process.env.SENTRY_DSN = original
    }
    jest.resetModules()
  })

  function loadWithSentryMock() {
    const init = jest.fn()
    const captureException = jest.fn()
    const loaded = jest.fn()
    jest.doMock("@sentry/node", () => {
      loaded()
      return { init, captureException }
    })
    return { init, captureException, loaded }
  }

  it("does not load or init the SDK when SENTRY_DSN is unset", () => {
    delete process.env.SENTRY_DSN
    const { init, loaded } = loadWithSentryMock()
    jest.isolateModules(() => {
      require("../../../../instrumentation").register()
    })
    expect(loaded).not.toHaveBeenCalled()
    expect(init).not.toHaveBeenCalled()
  })

  it("does not load or init the SDK when SENTRY_DSN is empty (compose default)", () => {
    process.env.SENTRY_DSN = ""
    const { loaded } = loadWithSentryMock()
    jest.isolateModules(() => {
      require("../../../../instrumentation").register()
    })
    expect(loaded).not.toHaveBeenCalled()
  })

  it("inits with PII collection off, no tracing and scrubbing hooks when SENTRY_DSN is set", () => {
    process.env.SENTRY_DSN = "https://public@o0.ingest.sentry.io/0"
    const { init } = loadWithSentryMock()
    jest.isolateModules(() => {
      require("../../../../instrumentation").register()
    })
    expect(init).toHaveBeenCalledTimes(1)
    const options = init.mock.calls[0][0]
    expect(options.dsn).toBe(process.env.SENTRY_DSN)
    expect(options.dataCollection).toEqual(SENTRY_DATA_COLLECTION)
    expect(options.tracesSampleRate).toBeUndefined()
    const event = options.beforeSend({ message: "x", user: { id: "cus_1", email: "a@b.co" } })
    expect(event).toEqual({ message: "x", user: { id: "cus_1" } })
    expect(options.beforeBreadcrumb({ message: "a@b.co" })).toEqual({ message: "[email]" })
  })
})

describe("sentryErrorHandler without SENTRY_DSN", () => {
  it("never loads the SDK, even for a 500", () => {
    delete process.env.SENTRY_DSN
    const loaded = jest.fn()
    jest.doMock("@sentry/node", () => {
      loaded()
      return { captureException: jest.fn() }
    })
    jest.isolateModules(() => {
      const { sentryErrorHandler } = require("../sentry-error-handler")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = { status: () => res, json: () => res, send: () => res }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req: any = { scope: { resolve: () => ({ error: () => {}, info: () => {} }) } }
      sentryErrorHandler(new Error("boom"), req, res, () => {})
    })
    expect(loaded).not.toHaveBeenCalled()
  })
})
