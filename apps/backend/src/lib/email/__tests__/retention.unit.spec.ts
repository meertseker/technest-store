import {
  DEFAULT_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  notificationRetentionDays,
  purgeOldNotifications,
  RETENTION_PAGE,
} from "../retention"

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-10-10T03:30:00Z")

type Row = { id: string; created_at: Date; to: string }

function setup(rows: Row[]) {
  const lines: string[] = []
  const deleted: string[][] = []
  const notifications = {
    listNotifications: jest.fn(async (filters: any, config: any = {}) => {
      const before = new Date(filters.created_at.$lt).getTime()
      return rows
        .filter((r) => r.created_at.getTime() < before)
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
        .slice(0, config.take ?? rows.length)
        .map((r) => ({ id: r.id }))
    }),
    deleteNotifications: jest.fn(async (ids: string[]) => {
      deleted.push(ids)
      for (const id of ids) rows.splice(rows.findIndex((r) => r.id === id), 1)
    }),
  }
  const logger = { info: (m: string) => lines.push(m), warn: (m: string) => lines.push(m) }
  return { deps: { notifications, logger }, rows, deleted, lines, notifications }
}

const row = (id: string, daysAgo: number): Row => ({
  id,
  created_at: new Date(NOW.getTime() - daysAgo * DAY),
  to: `${id}@example.com`,
})

describe("notificationRetentionDays", () => {
  it("defaults to 90 days and reads NOTIFICATION_RETENTION_DAYS", () => {
    expect(DEFAULT_RETENTION_DAYS).toBe(90)
    expect(notificationRetentionDays({})).toBe(90)
    expect(notificationRetentionDays({ NOTIFICATION_RETENTION_DAYS: "30" })).toBe(30)
    expect(notificationRetentionDays({ NOTIFICATION_RETENTION_DAYS: " 365 " })).toBe(365)
  })

  it("ignores junk and never goes below the floor the sweeper needs", () => {
    expect(notificationRetentionDays({ NOTIFICATION_RETENTION_DAYS: "abc" })).toBe(90)
    expect(notificationRetentionDays({ NOTIFICATION_RETENTION_DAYS: "" })).toBe(90)
    expect(notificationRetentionDays({ NOTIFICATION_RETENTION_DAYS: "0" })).toBe(MIN_RETENTION_DAYS)
    expect(notificationRetentionDays({ NOTIFICATION_RETENTION_DAYS: "2" })).toBe(MIN_RETENTION_DAYS)
    expect(MIN_RETENTION_DAYS).toBeGreaterThanOrEqual(7)
  })
})

describe("purgeOldNotifications", () => {
  it("hard-deletes rows older than the retention period and keeps the rest", async () => {
    const { deps, rows, notifications } = setup([row("old_a", 91), row("old_b", 400), row("edge", 90), row("fresh", 1)])

    const result = await purgeOldNotifications(deps, NOW, 90)

    expect(result).toEqual({ deleted: 2, cutoff: new Date(NOW.getTime() - 90 * DAY) })
    expect(rows.map((r) => r.id).sort()).toEqual(["edge", "fresh"])
    expect(notifications.listNotifications.mock.calls[0][0]).toEqual({
      created_at: { $lt: new Date(NOW.getTime() - 90 * DAY) },
    })
    // Ids only are read and deleted: nothing else about the row is loaded.
    expect(notifications.listNotifications.mock.calls[0][1]).toMatchObject({ select: ["id"], take: RETENTION_PAGE })
  })

  it("works through more rows than one page, oldest first, without skipping any", async () => {
    const many = Array.from({ length: RETENTION_PAGE * 2 + 5 }, (_, i) => row(`old_${i}`, 100 + i))
    const { deps, rows, deleted } = setup([...many, row("fresh", 5)])

    const result = await purgeOldNotifications(deps, NOW, 90)

    expect(result.deleted).toBe(RETENTION_PAGE * 2 + 5)
    expect(rows.map((r) => r.id)).toEqual(["fresh"])
    expect(deleted.map((d) => d.length)).toEqual([RETENTION_PAGE, RETENTION_PAGE, 5])
  })

  it("does nothing, and says nothing, when nothing is old enough", async () => {
    const { deps, notifications, lines } = setup([row("fresh", 1)])
    expect(await purgeOldNotifications(deps, NOW, 90)).toMatchObject({ deleted: 0 })
    expect(notifications.deleteNotifications).not.toHaveBeenCalled()
    expect(lines).toEqual([])
  })

  it("logs a count only, never an address or id", async () => {
    const { deps, lines } = setup([row("secret.person", 200)])
    await purgeOldNotifications(deps, NOW, 90)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/1 .*older than 90 days/)
    expect(lines[0]).not.toContain("secret.person")
  })
})
