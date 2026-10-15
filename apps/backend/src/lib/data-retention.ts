import { REPAIR_MODULE } from "../modules/repair"
import type RepairModuleService from "../modules/repair/service"
import { TRADE_MODULE } from "../modules/trade"
import type TradeModuleService from "../modules/trade/service"

/**
 * Personal data retention for the two records that hold a person's details
 * outside Medusa's own customer data: repair bookings (name, phone, email,
 * fault text) and trade applications (company, contact). Both are kept only
 * as long as the shop needs them:
 *
 * - a repair booking is removed REPAIR_RETENTION_DAYS after it was last
 *   updated, whatever its status: `done` ones after completion, and `new` or
 *   `booked` ones nobody followed up (an abandoned enquiry is personal data
 *   too),
 * - a `rejected` or `revoked` trade application is removed
 *   TRADE_RETENTION_DAYS after the decision,
 * - a row staff deleted (soft delete) is removed for good after the same
 *   period.
 *
 * Removal is a hard delete: the point is that the data is gone.
 */
export const DEFAULT_RETENTION_DAYS = 365

const DAY_MS = 24 * 60 * 60 * 1000

type Resolver = { resolve: <T = any>(key: string) => T }

export type RetentionEnv = {
  REPAIR_RETENTION_DAYS?: string
  TRADE_RETENTION_DAYS?: string
}

export type PurgeResult = { repair_bookings: number; trade_applications: number }

/** Whole positive days from an env value; anything else means the default. */
export function retentionDays(value: string | undefined): number {
  const trimmed = value?.trim()
  if (!trimmed) {
    return DEFAULT_RETENTION_DAYS
  }
  const days = Number(trimmed)
  return Number.isInteger(days) && days > 0 ? days : DEFAULT_RETENTION_DAYS
}

const cutoff = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS)

export async function purgeExpiredRecords(
  container: Resolver,
  { now = new Date(), env = process.env as RetentionEnv }: { now?: Date; env?: RetentionEnv } = {}
): Promise<PurgeResult> {
  const repair = container.resolve<RepairModuleService>(REPAIR_MODULE)
  const trade = container.resolve<TradeModuleService>(TRADE_MODULE)
  const repairCutoff = cutoff(now, retentionDays(env.REPAIR_RETENTION_DAYS))
  const tradeCutoff = cutoff(now, retentionDays(env.TRADE_RETENTION_DAYS))
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id)

  let repairBookings = 0
  const finished = ids(
    await repair.listRepairBookings(
      { updated_at: { $lt: repairCutoff } },
      { select: ["id"], take: null }
    )
  )
  if (finished.length) {
    await repair.deleteRepairBookings(finished)
    repairBookings += finished.length
  }
  const removedBookings = ids(
    await repair.listRepairBookings(
      { deleted_at: { $lt: repairCutoff } },
      { select: ["id"], take: null, withDeleted: true }
    )
  )
  if (removedBookings.length) {
    await repair.deleteRepairBookings(removedBookings)
    repairBookings += removedBookings.length
  }

  let tradeApplications = 0
  const closed = ids(
    await trade.listTradeApplications(
      { status: ["rejected", "revoked"], updated_at: { $lt: tradeCutoff } },
      { select: ["id"], take: null }
    )
  )
  if (closed.length) {
    await trade.deleteTradeApplications(closed)
    tradeApplications += closed.length
  }
  const removedApplications = ids(
    await trade.listTradeApplications(
      { deleted_at: { $lt: tradeCutoff } },
      { select: ["id"], take: null, withDeleted: true }
    )
  )
  if (removedApplications.length) {
    await trade.deleteTradeApplications(removedApplications)
    tradeApplications += removedApplications.length
  }

  return { repair_bookings: repairBookings, trade_applications: tradeApplications }
}
