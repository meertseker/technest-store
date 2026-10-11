import type { Logger } from "@medusajs/framework/types"

/**
 * Retention for the `notification` table.
 *
 * Every send attempt is stored there with the recipient's address (the
 * module requires `to`, and both the send-once check and the email-sweeper
 * key on it). Nothing else personal is stored since the email is rendered in
 * the attempt and only `{ recipient, ids }` goes in `data`, but an address is
 * personal data too and there is no reason to keep it for ever. Rows older
 * than NOTIFICATION_RETENTION_DAYS (default 90) are hard-deleted once a day.
 *
 * Deleting every old row is safe for the rest of the email code:
 *  - the send-once check only matters while an event can still be replayed,
 *    and no event is replayed months later;
 *  - the sweeper reads attempts from the last three days only;
 *  - a later email about the same order (dispatch, refund, cancellation) is
 *    its own template, so its rows are new.
 * The floor below keeps the sweeper's window intact however the env is set.
 */
export const DEFAULT_RETENTION_DAYS = 90
/** Never less than this: the sweeper looks back three days for attempts to send again. */
export const MIN_RETENTION_DAYS = 7
/** Rows read and deleted per round trip. */
export const RETENTION_PAGE = 500
/** Most rows one run deletes (a first run on a big backlog stays short; the next day takes the rest). */
export const RETENTION_MAX_PER_RUN = 20_000

const DAY = 24 * 60 * 60 * 1000

export function notificationRetentionDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.NOTIFICATION_RETENTION_DAYS?.trim()
  const n = raw ? Number(raw) : NaN
  if (!Number.isInteger(n)) return DEFAULT_RETENTION_DAYS
  return Math.max(n, MIN_RETENTION_DAYS)
}

export type RetentionDeps = {
  notifications: {
    listNotifications(filters: Record<string, unknown>, config?: Record<string, unknown>): Promise<{ id: string }[]>
    /** The module's generated hard delete (not softDeleteNotifications). */
    deleteNotifications(ids: string[]): Promise<unknown>
  }
  logger: Pick<Logger, "info" | "warn">
}

export type PurgeResult = { deleted: number; cutoff: Date }

export async function purgeOldNotifications(deps: RetentionDeps, now: Date, retentionDays: number): Promise<PurgeResult> {
  const cutoff = new Date(now.getTime() - retentionDays * DAY)
  let deleted = 0
  while (deleted < RETENTION_MAX_PER_RUN) {
    // Always the first page: each round deletes what it read.
    const page = await deps.notifications.listNotifications(
      { created_at: { $lt: cutoff } },
      { select: ["id"], order: { created_at: "ASC" }, take: RETENTION_PAGE }
    )
    if (!page.length) break
    await deps.notifications.deleteNotifications(page.map((r) => r.id))
    deleted += page.length
    if (page.length < RETENTION_PAGE) break
  }
  if (deleted) {
    // A count only: never an address or an id.
    deps.logger.info(`notification-retention: deleted ${deleted} stored email attempt(s) older than ${retentionDays} days`)
  }
  return { deleted, cutoff }
}
