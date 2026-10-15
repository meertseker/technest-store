import { purgeExpiredRecords, retentionDays } from "../data-retention"

const DAY = 24 * 60 * 60 * 1000
const now = new Date("2026-10-11T03:15:00Z")
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY)

function fakeContainer() {
  const repair = {
    listRepairBookings: jest.fn().mockResolvedValue([]),
    deleteRepairBookings: jest.fn().mockResolvedValue(undefined),
  }
  const trade = {
    listTradeApplications: jest.fn().mockResolvedValue([]),
    deleteTradeApplications: jest.fn().mockResolvedValue(undefined),
  }
  const container = {
    resolve: (key: string) => (key === "repair" ? repair : key === "trade" ? trade : undefined),
  } as any
  return { container, repair, trade }
}

describe("retentionDays", () => {
  it("defaults to 365 days and ignores values that are not whole positive numbers", () => {
    expect(retentionDays(undefined)).toBe(365)
    expect(retentionDays("")).toBe(365)
    expect(retentionDays("0")).toBe(365)
    expect(retentionDays("-5")).toBe(365)
    expect(retentionDays("abc")).toBe(365)
    expect(retentionDays("12.5")).toBe(365)
    expect(retentionDays("90")).toBe(90)
  })
})

describe("purgeExpiredRecords", () => {
  it("hard-deletes repair bookings of any status and closed trade applications past their retention", async () => {
    const { container, repair, trade } = fakeContainer()
    repair.listRepairBookings.mockResolvedValueOnce([{ id: "rep_old" }, { id: "rep_old2" }]).mockResolvedValueOnce([])
    trade.listTradeApplications.mockResolvedValueOnce([{ id: "tapp_old" }]).mockResolvedValueOnce([])

    const result = await purgeExpiredRecords(container, {
      now,
      env: { REPAIR_RETENTION_DAYS: "30", TRADE_RETENTION_DAYS: "400" },
    })

    expect(result).toEqual({ repair_bookings: 2, trade_applications: 1 })
    expect(repair.listRepairBookings).toHaveBeenCalledWith(
      { updated_at: { $lt: daysAgo(30) } },
      expect.objectContaining({ select: ["id"], take: null })
    )
    expect(repair.deleteRepairBookings).toHaveBeenCalledWith(["rep_old", "rep_old2"])
    expect(trade.listTradeApplications).toHaveBeenCalledWith(
      { status: ["rejected", "revoked"], updated_at: { $lt: daysAgo(400) } },
      expect.objectContaining({ select: ["id"], take: null })
    )
    expect(trade.deleteTradeApplications).toHaveBeenCalledWith(["tapp_old"])
  })

  it("also removes rows that were soft-deleted longer ago than the retention", async () => {
    const { container, repair, trade } = fakeContainer()
    repair.listRepairBookings.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "rep_soft" }])
    trade.listTradeApplications.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "tapp_soft" }])

    const result = await purgeExpiredRecords(container, { now, env: {} })

    expect(result).toEqual({ repair_bookings: 1, trade_applications: 1 })
    expect(repair.listRepairBookings).toHaveBeenLastCalledWith(
      { deleted_at: { $lt: daysAgo(365) } },
      expect.objectContaining({ withDeleted: true })
    )
    expect(trade.listTradeApplications).toHaveBeenLastCalledWith(
      { deleted_at: { $lt: daysAgo(365) } },
      expect.objectContaining({ withDeleted: true })
    )
    expect(repair.deleteRepairBookings).toHaveBeenCalledWith(["rep_soft"])
    expect(trade.deleteTradeApplications).toHaveBeenCalledWith(["tapp_soft"])
  })

  it("deletes nothing when nothing has expired", async () => {
    const { container, repair, trade } = fakeContainer()
    await expect(purgeExpiredRecords(container, { now, env: {} })).resolves.toEqual({
      repair_bookings: 0,
      trade_applications: 0,
    })
    expect(repair.deleteRepairBookings).not.toHaveBeenCalled()
    expect(trade.deleteTradeApplications).not.toHaveBeenCalled()
  })
})
