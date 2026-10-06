import { reportAlert, reportError, reportingJob, reportingSubscriber, setAlertSinkForTests, type Alert } from ".."

describe("alerting", () => {
  let seen: Alert[]
  beforeEach(() => {
    seen = []
    setAlertSinkForTests((a) => seen.push(a))
  })
  afterEach(() => setAlertSinkForTests(undefined))

  it("reports an error with where it happened and ids", () => {
    const error = new Error("boom")
    reportError(error, { source: "job:capture-retry", order_id: "order_1" })
    expect(seen).toEqual([{ error, tags: { source: "job:capture-retry", order_id: "order_1" } }])
  })

  it("reports a message for a condition that is not an exception", () => {
    reportAlert("3 emails are failing to send", { source: "job:email-sweeper" })
    expect(seen).toEqual([{ message: "3 emails are failing to send", tags: { source: "job:email-sweeper" } }])
  })

  it("never throws, even when reporting itself fails", () => {
    setAlertSinkForTests(() => {
      throw new Error("sentry is down")
    })
    expect(() => reportError(new Error("boom"), { source: "x" })).not.toThrow()
    expect(() => reportAlert("m", { source: "x" })).not.toThrow()
  })

  it("does nothing when reporting is off", () => {
    setAlertSinkForTests(null)
    expect(() => reportError(new Error("boom"), { source: "x" })).not.toThrow()
  })

  describe("reportingJob", () => {
    it("reports a job that throws, once, and lets the framework see the failure", async () => {
      const error = new Error("db down")
      const job = reportingJob("low-stock", async () => {
        throw error
      })
      await expect(job({} as any)).rejects.toBe(error)
      expect(seen).toEqual([{ error, tags: { source: "job:low-stock" } }])
    })

    it("passes the container through and reports nothing for a job that finishes", async () => {
      const container = { resolve: jest.fn() } as any
      const handler = jest.fn(async () => "done")
      expect(await reportingJob("ok", handler)(container)).toBe("done")
      expect(handler).toHaveBeenCalledWith(container)
      expect(seen).toEqual([])
    })
  })

  describe("reportingSubscriber", () => {
    const args = { event: { name: "order.placed", data: { id: "order_1" } }, container: {} } as any

    it("reports a subscriber that throws, once, and rethrows so the event bus retries it", async () => {
      const error = new Error("boom")
      const subscriber = reportingSubscriber("order-placed-capture", async () => {
        throw error
      })
      await expect(subscriber(args)).rejects.toBe(error)
      expect(seen).toEqual([{ error, tags: { source: "subscriber:order-placed-capture", event: "order.placed" } }])
    })

    it("keeps the handler's name, which Medusa uses as the subscriber id", () => {
      async function orderPlacedEmails() {}
      expect(reportingSubscriber("order-placed-emails", orderPlacedEmails).name).toBe("orderPlacedEmails")
    })

    it("does not report errors the subscriber throws on purpose to be retried", async () => {
      const busy = new Error("Failed to acquire lock for key order_1")
      const subscriber = reportingSubscriber(
        "order-placed-capture",
        async () => {
          throw busy
        },
        { ignore: (e) => /acquire lock/.test((e as Error).message) }
      )
      await expect(subscriber(args)).rejects.toBe(busy)
      expect(seen).toEqual([])
    })
  })
})

describe("alerting without SENTRY_DSN", () => {
  const original = process.env.SENTRY_DSN
  afterEach(() => {
    if (original === undefined) delete process.env.SENTRY_DSN
    else process.env.SENTRY_DSN = original
    jest.resetModules()
  })

  it("never loads the SDK", () => {
    delete process.env.SENTRY_DSN
    const loaded = jest.fn()
    jest.doMock("@sentry/node", () => {
      loaded()
      return {}
    })
    jest.isolateModules(() => {
      require("..").reportError(new Error("boom"), { source: "x" })
    })
    expect(loaded).not.toHaveBeenCalled()
  })

  it("sends errors and messages to Sentry with their tags when SENTRY_DSN is set", () => {
    process.env.SENTRY_DSN = "https://public@o0.ingest.sentry.io/0"
    const scope = { setTags: jest.fn(), setFingerprint: jest.fn() }
    const captureException = jest.fn()
    const captureMessage = jest.fn()
    jest.doMock("@sentry/node", () => ({
      withScope: (fn: (s: typeof scope) => void) => fn(scope),
      captureException,
      captureMessage,
    }))
    const error = new Error("boom")
    jest.isolateModules(() => {
      const alerting = require("..")
      alerting.reportError(error, { source: "job:x", order_id: "order_1" })
      alerting.reportAlert("emails are failing", { source: "job:email-sweeper" }, "email-sweeper-failing")
    })
    expect(captureException).toHaveBeenCalledWith(error)
    expect(captureMessage).toHaveBeenCalledWith("emails are failing", "error")
    expect(scope.setTags).toHaveBeenCalledWith({ source: "job:x", order_id: "order_1" })
    expect(scope.setFingerprint).toHaveBeenCalledWith(["email-sweeper-failing"])
  })
})
