const listUncollected = jest.fn()
jest.mock("../../lib/click-collect/list", () => ({ listUncollectedOrders: (...a: unknown[]) => listUncollected(...a) }))
const expireRun = jest.fn()
jest.mock("../../workflows/uncollected-orders", () => ({
  expireUncollectedOrderWorkflow: () => ({ run: expireRun }),
  remindUncollectedOrderWorkflow: () => ({ run: jest.fn() }),
}))
const retryUncaptured = jest.fn()
jest.mock("../../lib/capture-retry", () => ({ retryUncapturedDeliveryOrders: (...a: unknown[]) => retryUncaptured(...a) }))
const releaseStuck = jest.fn()
jest.mock("../../lib/authorisation-release", () => ({ releaseStuckAuthorisations: (...a: unknown[]) => releaseStuck(...a) }))
const reconcile = jest.fn()
jest.mock("../../lib/payment-reconcile", () => ({
  RECONCILE_CATCH_UP_MS: 1000,
  reconcilePayments: (...a: unknown[]) => reconcile(...a),
}))
const purge = jest.fn()
// The job removes data through a workflow (every mutation goes through one).
jest.mock("../../workflows/purge-expired-records", () => ({
  purgeExpiredRecordsWorkflow: () => ({ run: (...a: unknown[]) => purge(...a) }),
}))
jest.mock("../../lib/data-retention", () => ({
  purgeExpiredRecords: () => {
    throw new Error("the job must not delete outside the workflow")
  },
}))
const lowStockRun = jest.fn()
jest.mock("../../workflows/emit-low-stock-digest", () => ({ emitLowStockDigestWorkflow: () => ({ run: lowStockRun }) }))
jest.mock("../../lib/low-stock", () => ({
  ...jest.requireActual("../../lib/low-stock"),
  isLowStockDue: () => true,
}))

import { setAlertSinkForTests, type Alert } from "../../lib/alerting"
import authorisationReleaseJob from "../authorisation-release"
import captureRetryJob from "../capture-retry"
import clickCollectLifecycleJob from "../click-collect-lifecycle"
import dataRetentionJob from "../data-retention"
import lowStockDigestJob from "../low-stock-digest"
import paymentReconcileJob from "../payment-reconcile"

const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() }
const locking = { execute: (_key: string, job: () => Promise<unknown>) => job() }
const container = { resolve: (key: string) => (key === "locking" ? locking : logger) } as any

describe("a scheduled job that fails is reported, not only logged", () => {
  let alerts: Alert[]
  beforeEach(() => {
    alerts = []
    setAlertSinkForTests((a) => alerts.push(a))
    jest.clearAllMocks()
  })
  afterEach(() => setAlertSinkForTests(undefined))

  it("click-collect-lifecycle: listing the orders fails", async () => {
    const error = new Error("db down")
    listUncollected.mockRejectedValue(error)
    await expect(clickCollectLifecycleJob(container)).resolves.toBeUndefined()
    expect(alerts).toEqual([{ error, tags: { source: "job:click-collect-lifecycle" } }])
  })

  it("click-collect-lifecycle: one order fails, the others still run", async () => {
    const error = new Error("cancel failed")
    const old = { created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), metadata: {} }
    listUncollected.mockResolvedValue([{ id: "order_1", ...old }, { id: "order_2", ...old }])
    expireRun.mockRejectedValueOnce(error).mockResolvedValueOnce({ result: { expired: true } })
    await clickCollectLifecycleJob(container)
    expect(expireRun).toHaveBeenCalledTimes(2)
    expect(alerts).toEqual([{ error, tags: { source: "job:click-collect-lifecycle", order_id: "order_1", action: "expire" } }])
  })

  it.each([
    ["capture-retry", captureRetryJob, retryUncaptured],
    ["authorisation-release", authorisationReleaseJob, releaseStuck],
    ["payment-reconcile", paymentReconcileJob, reconcile],
    ["data-retention", dataRetentionJob, purge],
  ])("%s: the run fails", async (name, job, work) => {
    const error = new Error("db down")
    work.mockRejectedValue(error)
    await expect(job(container)).resolves.toBeUndefined()
    expect(alerts).toEqual([{ error, tags: { source: `job:${name}` } }])
  })

  it.each([
    ["capture-retry", captureRetryJob, retryUncaptured],
    ["payment-reconcile", paymentReconcileJob, reconcile],
    ["data-retention", dataRetentionJob, purge],
  ])("%s: an overlapping run is not a failure", async (_name, job, work) => {
    work.mockRejectedValue(new Error("Timed-out acquiring lock"))
    await job(container)
    expect(alerts).toEqual([])
  })

  it("data-retention: removes the data through the workflow and logs the counts", async () => {
    purge.mockResolvedValue({ result: { repair_bookings: 2, trade_applications: 1 } })
    await dataRetentionJob(container)
    expect(purge).toHaveBeenCalledTimes(1)
    expect(alerts).toEqual([])
    expect(logger.info).toHaveBeenCalledWith(
      "data-retention: removed 2 repair bookings and 1 trade applications"
    )
  })

  it("low-stock digest: the check fails", async () => {
    const error = new Error("db down")
    lowStockRun.mockRejectedValue(error)
    await expect(lowStockDigestJob(container)).resolves.toBeUndefined()
    expect(alerts).toEqual([{ error, tags: { source: "job:technest-low-stock-digest" } }])
  })
})
