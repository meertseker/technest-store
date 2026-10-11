const run = jest.fn()
jest.mock("../../workflows/emit-low-stock-digest", () => ({ emitLowStockDigestWorkflow: () => ({ run }) }))

import { isLowStockDue } from "../../lib/low-stock"
import lowStockDigestJob, { resetLowStockDigestStateForTests } from "../low-stock-digest"

const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() }
const container = { resolve: () => logger } as any

const at = async (iso: string) => {
  jest.setSystemTime(new Date(iso))
  await lowStockDigestJob(container)
}

describe("isLowStockDue (pure)", () => {
  it("is due from 08:00 London on a day with no run yet, and not before", () => {
    expect(isLowStockDue(new Date("2026-01-15T07:59:00Z"), {})).toBe(false)
    expect(isLowStockDue(new Date("2026-01-15T08:00:00Z"), {})).toBe(true)
    expect(isLowStockDue(new Date("2026-01-15T15:00:00Z"), {})).toBe(true)
    // BST: 07:00Z is 08:00 London.
    expect(isLowStockDue(new Date("2026-07-15T06:59:00Z"), {})).toBe(false)
    expect(isLowStockDue(new Date("2026-07-15T07:00:00Z"), {})).toBe(true)
  })

  it("is not due again on a day that already ran, and is due again the next day", () => {
    expect(isLowStockDue(new Date("2026-01-15T09:00:00Z"), { lastRunDay: "2026-01-15" })).toBe(false)
    expect(isLowStockDue(new Date("2026-01-16T08:00:00Z"), { lastRunDay: "2026-01-15" })).toBe(true)
  })
})

describe("the hourly job", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    run.mockReset().mockResolvedValue({ result: { items: [] } })
    logger.error.mockReset()
    resetLowStockDigestStateForTests()
  })
  afterEach(() => jest.useRealTimers())

  it("runs the check once a day, on the 08:00 London run", async () => {
    await at("2026-01-15T07:00:00Z")
    expect(run).not.toHaveBeenCalled()
    await at("2026-01-15T08:00:10Z")
    expect(run).toHaveBeenCalledTimes(1)
    for (const h of ["09", "12", "23"]) await at(`2026-01-15T${h}:00:10Z`)
    expect(run).toHaveBeenCalledTimes(1)
    await at("2026-01-16T08:00:10Z")
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("still runs on the first run after 08:00 when the worker was down across the 08:00 hour", async () => {
    await at("2026-01-15T07:00:10Z")
    // 08:00 and 09:00 never happened (a deploy, a restart).
    await at("2026-01-15T10:00:10Z")
    expect(run).toHaveBeenCalledTimes(1)
    await at("2026-01-15T11:00:10Z")
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("tries again next hour when the check itself failed", async () => {
    run.mockRejectedValueOnce(new Error("db down"))
    await at("2026-01-15T08:00:10Z")
    expect(logger.error).toHaveBeenCalledTimes(1)
    await at("2026-01-15T09:00:10Z")
    expect(run).toHaveBeenCalledTimes(2)
    await at("2026-01-15T10:00:10Z")
    expect(run).toHaveBeenCalledTimes(2)
  })
})
