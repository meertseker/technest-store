import { setAlertSinkForTests, type Alert } from "../../alerting"
import { forgetSweepAttemptsForTests, sweepFailedEmails, SWEEP_GIVE_UP_AFTER_MS } from "../sweeper"

const MIN = 60_000
const HOUR = 60 * MIN
const T0 = Date.parse("2026-10-06T09:00:00Z")
const at = (ms: number) => new Date(T0 + ms)

type Row = {
  id: string
  to: string
  channel: string
  template: string
  resource_id: string
  resource_type: string
  trigger_type: string
  status: "failure" | "success" | "pending"
  data: Record<string, unknown> | null
  created_at: Date
}

let seq = 0
const row = (over: Partial<Row> & { created_at: Date }): Row => ({
  id: `noti_${++seq}`,
  to: "sam@example.com",
  channel: "email",
  template: "order-confirmation",
  resource_id: "order_1",
  resource_type: "order",
  trigger_type: "order.placed",
  status: "failure",
  data: { recipient: "customer" },
  ...over,
})

const smtpDown = () => new Error("Failed to send notification with id noti_x:\nsmtp: send failed template=t code=ECONNECTION")

function setup(rows: Row[], deliver: jest.Mock = jest.fn(async () => ({ id: "noti_sent" }))) {
  const lines: string[] = []
  const log = (m: string) => lines.push(m)
  const notifications = {
    listNotifications: jest.fn(async (filters: any, config: any = {}) => {
      const statuses: string[] = [filters.status].flat()
      const since = filters.created_at?.$gte ? new Date(filters.created_at.$gte).getTime() : 0
      const matching = rows
        .filter((r) => statuses.includes(r.status) && r.created_at.getTime() >= since)
        .filter((r) => !filters.resource_id || [filters.resource_id].flat().includes(r.resource_id))
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      return matching.slice(config.skip ?? 0, (config.skip ?? 0) + (config.take ?? matching.length))
    }),
    updateNotifications: jest.fn(async (updates: any[]) => {
      for (const u of updates) Object.assign(rows.find((r) => r.id === u.id)!, u)
      return updates
    }),
  }
  const deps = { notifications, deliver, logger: { info: log, warn: log, error: log } }
  return { deps, deliver, notifications, lines, rows }
}

describe("sweepFailedEmails", () => {
  let alerts: Alert[]
  beforeEach(() => {
    alerts = []
    setAlertSinkForTests((a) => alerts.push(a))
    forgetSweepAttemptsForTests()
  })
  afterEach(() => setAlertSinkForTests(undefined))

  it("leaves a fresh failure to the send's own retries", async () => {
    const s = setup([row({ created_at: at(0) })])
    const result = await sweepFailedEmails(s.deps, at(5 * MIN))
    expect(s.deliver).not.toHaveBeenCalled()
    expect(result).toMatchObject({ sent: 0, failed: 0, waiting: 1 })
    expect(alerts).toEqual([])
  })

  it("sends a failed email again ten minutes after its last attempt, from the ids stored with it", async () => {
    const s = setup([
      row({ created_at: at(0), template: "shop-low-stock-digest", resource_id: "low_stock_2026-10-06", resource_type: "low_stock_digest", trigger_type: "technest.inventory.low_stock", data: { recipient: "shop", ids: ["variant_1"] } }),
    ])
    const result = await sweepFailedEmails(s.deps, at(10 * MIN))
    expect(s.deliver).toHaveBeenCalledTimes(1)
    expect(s.deliver).toHaveBeenCalledWith({
      template: "shop-low-stock-digest",
      resource_id: "low_stock_2026-10-06",
      resource_type: "low_stock_digest",
      trigger_type: "technest.inventory.low_stock",
      recipient: "shop",
      ids: ["variant_1"],
    })
    expect(result).toMatchObject({ sent: 1, failed: 0, gave_up: 0 })
    // It recovered on its own: nobody needs telling.
    expect(alerts).toEqual([])
  })

  it("ignores an email that has gone out since", async () => {
    const s = setup([row({ created_at: at(0) }), row({ created_at: at(MIN), status: "success" })])
    const result = await sweepFailedEmails(s.deps, at(HOUR))
    expect(s.deliver).not.toHaveBeenCalled()
    expect(result).toMatchObject({ sent: 0, waiting: 0 })
  })

  it("treats a resend (send key) as its own email, and sends it again with its key", async () => {
    const s = setup([
      row({ created_at: at(0), template: "ready-for-collection", status: "success" }),
      row({ created_at: at(MIN), template: "ready-for-collection", data: { recipient: "customer", send_key: "resend:x" } }),
    ])
    await sweepFailedEmails(s.deps, at(HOUR))
    expect(s.deliver).toHaveBeenCalledTimes(1)
    expect(s.deliver.mock.calls[0][0]).toMatchObject({ template: "ready-for-collection", send_key: "resend:x" })

    const done = setup([
      row({ created_at: at(0), template: "ready-for-collection", data: { recipient: "customer", send_key: "resend:x" } }),
      row({ created_at: at(MIN), template: "ready-for-collection", status: "success", data: { recipient: "customer", send_key: "resend:x" } }),
    ])
    await sweepFailedEmails(done.deps, at(HOUR))
    expect(done.deliver).not.toHaveBeenCalled()
  })

  it("treats each recipient of the same order as its own email", async () => {
    const s = setup([
      row({ created_at: at(0) }),
      row({ created_at: at(0), to: "shop@example.com", template: "shop-new-order", data: { recipient: "shop" } }),
      row({ created_at: at(MIN), to: "shop@example.com", template: "shop-new-order", status: "success" }),
    ])
    await sweepFailedEmails(s.deps, at(HOUR))
    expect(s.deliver).toHaveBeenCalledTimes(1)
    expect(s.deliver.mock.calls[0][0]).toMatchObject({ template: "order-confirmation", recipient: "customer" })
  })

  it("waits longer between attempts the longer an email has been failing", async () => {
    // Failing for an hour: the next attempt is an hour after the last one.
    const s = setup([row({ created_at: at(0) }), row({ created_at: at(HOUR) })])
    await sweepFailedEmails(s.deps, at(HOUR + 50 * MIN))
    expect(s.deliver).not.toHaveBeenCalled()
    await sweepFailedEmails(s.deps, at(2 * HOUR))
    expect(s.deliver).toHaveBeenCalledTimes(1)
  })

  it("never waits more than four hours", async () => {
    const s = setup([row({ created_at: at(0) }), row({ created_at: at(12 * HOUR) })])
    await sweepFailedEmails(s.deps, at(16 * HOUR))
    expect(s.deliver).toHaveBeenCalledTimes(1)
  })

  it("raises one alert per run while emails keep failing, without any address", async () => {
    const deliver = jest.fn(async () => {
      throw smtpDown()
    })
    const s = setup(
      [row({ created_at: at(0) }), row({ created_at: at(0), resource_id: "order_2", to: "kim@example.com" })],
      deliver
    )
    const result = await sweepFailedEmails(s.deps, at(15 * MIN))
    expect(result).toMatchObject({ sent: 0, failed: 2, gave_up: 0 })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].message).toMatch(/2 emails? .*failing/)
    expect(alerts[0].tags).toEqual({ source: "job:email-sweeper" })
    expect(alerts[0].fingerprint).toBe("email-sweeper-failing")
    const everything = JSON.stringify(alerts) + s.lines.join("\n")
    expect(everything).not.toContain("sam@example.com")
    expect(everything).not.toContain("kim@example.com")
  })

  it("makes a last attempt after 24 hours, then gives up and says which email, once", async () => {
    const deliver = jest.fn(async () => {
      throw smtpDown()
    })
    const s = setup([row({ created_at: at(0) }), row({ created_at: at(20 * HOUR) })], deliver)

    const result = await sweepFailedEmails(s.deps, at(SWEEP_GIVE_UP_AFTER_MS + MIN))
    expect(deliver).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ failed: 1, gave_up: 1 })
    const gaveUp = alerts.filter((a) => /giving up/.test(a.message ?? ""))
    expect(gaveUp).toHaveLength(1)
    expect(gaveUp[0].message).toContain("template=order-confirmation")
    expect(gaveUp[0].message).toContain("order=order_1")
    expect(gaveUp[0].tags).toEqual({
      source: "job:email-sweeper",
      template: "order-confirmation",
      resource_type: "order",
      resource_id: "order_1",
      audience: "customer",
    })
    expect(JSON.stringify(alerts)).not.toContain("sam@example.com")
    expect(s.lines.join("\n")).toContain("giving up")

    // Later runs leave it alone and stay quiet.
    alerts.length = 0
    deliver.mockClear()
    const later = await sweepFailedEmails(s.deps, at(SWEEP_GIVE_UP_AFTER_MS + 5 * HOUR))
    expect(deliver).not.toHaveBeenCalled()
    expect(later).toMatchObject({ failed: 0, gave_up: 0 })
    expect(alerts).toEqual([])
  })

  it("does not give up on an email whose last attempt gets through", async () => {
    const s = setup([row({ created_at: at(0) })])
    const result = await sweepFailedEmails(s.deps, at(SWEEP_GIVE_UP_AFTER_MS + HOUR))
    expect(result).toMatchObject({ sent: 1, gave_up: 0 })
    expect(alerts).toEqual([])
  })

  it("closes an email that no longer has anything to send, without an alert", async () => {
    const deliver = jest.fn(async () => ({ skipped: true as const }))
    const s = setup([row({ created_at: at(0) })], deliver)
    const result = await sweepFailedEmails(s.deps, at(HOUR))
    expect(result).toMatchObject({ closed: 1, sent: 0, failed: 0 })
    expect(alerts).toEqual([])

    deliver.mockClear()
    await sweepFailedEmails(s.deps, at(3 * HOUR))
    expect(deliver).not.toHaveBeenCalled()
  })

  it("says so when a failed email can't be sent again because nothing was stored to rebuild it", async () => {
    const s = setup([row({ created_at: at(0), template: "integration-test", data: null })])
    const result = await sweepFailedEmails(s.deps, at(HOUR))
    expect(s.deliver).not.toHaveBeenCalled()
    expect(result).toMatchObject({ gave_up: 1 })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].message).toContain("template=integration-test")

    alerts.length = 0
    await sweepFailedEmails(s.deps, at(2 * HOUR))
    expect(alerts).toEqual([])
  })

  it("leaves password resets alone: the link has expired and the token was never stored", async () => {
    const s = setup([
      row({ created_at: at(0), template: "password-reset", resource_id: "reset_abc", resource_type: "auth", data: {} }),
    ])
    const result = await sweepFailedEmails(s.deps, at(HOUR))
    expect(s.deliver).not.toHaveBeenCalled()
    expect(result).toMatchObject({ gave_up: 0, failed: 0 })
    expect(alerts).toEqual([])
    expect(s.notifications.updateNotifications).not.toHaveBeenCalled()
  })

  it("picks up a send that was cut off mid-way (still pending after ten minutes)", async () => {
    const s = setup([
      row({ created_at: at(0), status: "pending" }),
      row({ created_at: at(55 * MIN), status: "pending", resource_id: "order_2" }),
    ])
    await sweepFailedEmails(s.deps, at(HOUR))
    expect(s.deliver).toHaveBeenCalledTimes(1)
    expect(s.deliver.mock.calls[0][0]).toMatchObject({ resource_id: "order_1" })
  })

  it("stops hammering a mail server that is down after three failures in a row", async () => {
    const deliver = jest.fn(async () => {
      throw smtpDown()
    })
    const rows = Array.from({ length: 10 }, (_, i) => row({ created_at: at(i), resource_id: `order_${i}` }))
    const s = setup(rows, deliver)
    const result = await sweepFailedEmails(s.deps, at(HOUR))
    expect(deliver).toHaveBeenCalledTimes(3)
    expect(result).toMatchObject({ failed: 3 })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].message).toMatch(/10 emails? .*failing/)
  })

  it("one email that can't be built does not hold up the others, and is not tried on every run", async () => {
    const rows = [
      row({ created_at: at(0), resource_id: "order_gone" }),
      row({ created_at: at(1), resource_id: "order_2" }),
      row({ created_at: at(2), resource_id: "order_3" }),
    ]
    const deliver = jest.fn(async (input: { resource_id: string }) => {
      if (input.resource_id === "order_gone") throw new Error("Order order_gone not found")
      rows.push(row({ created_at: at(HOUR), resource_id: input.resource_id, status: "success" }))
      return { id: "noti_sent" }
    })
    const s = setup(rows, deliver as jest.Mock)
    const result = await sweepFailedEmails(s.deps, at(HOUR))
    expect(result).toMatchObject({ sent: 2, failed: 1 })

    // No new attempt was stored for it, but it still waits its turn.
    deliver.mockClear()
    await sweepFailedEmails(s.deps, at(HOUR + 10 * MIN))
    expect(deliver).not.toHaveBeenCalled()
  })
})
