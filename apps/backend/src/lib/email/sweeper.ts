import type { Logger } from "@medusajs/framework/types"
import { reportAlert } from "../alerting"
import type { SendEmailInput } from "./deliver"
import { isSmtpSendFailure, safeErrorMessage } from "./safe-error"
import type { SendEmailOnceResult } from "./send-email-once"

/**
 * Emails that failed are tried again here, for a day.
 *
 * The send itself retries for about five minutes (workflows/send-email.ts).
 * After that the only trace used to be a log line and a "failure" row: the
 * customer never got the confirmation, the shop never got the new-order alert,
 * and nobody knew. This sweep looks at the stored attempts, sends again every
 * email that has no successful attempt, with a growing wait, and tells a
 * person (lib/alerting) while emails keep failing and when it gives one up.
 *
 * Each attempt reloads the data and goes through the same send-once check, so
 * an email is never sent twice from here.
 */

/** No sweep attempt sooner than this after the last attempt: the send's own retries come first. */
export const SWEEP_FIRST_RETRY_AFTER_MS = 10 * 60 * 1000
/** Longest wait between two attempts. */
export const SWEEP_MAX_WAIT_MS = 4 * 60 * 60 * 1000
/** After this long one last attempt is made, then the email is given up. */
export const SWEEP_GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000
/** How far back attempts are read: past the give-up point, so a worker that was down a day still closes them. */
const LOOKBACK_MS = SWEEP_GIVE_UP_AFTER_MS * 3
/** A mail server that fails this many sends in a row is down: stop until the next run. */
const STOP_AFTER_FAILURES_IN_A_ROW = 3
/** Most attempts in one run (a recovered server is not flooded, a run stays short). */
const MAX_ATTEMPTS_PER_RUN = 50
const PAGE = 500
const MAX_ROWS = 10_000

/** Sent outside the workflow with a short-lived secret that is never stored: can't and mustn't be sent again. */
const NEVER_RESENT = new Set(["password-reset"])

type Row = {
  id: string
  to: string
  template?: string | null
  resource_id?: string | null
  resource_type?: string | null
  trigger_type?: string | null
  status: string
  data?: Record<string, unknown> | null
  created_at: Date | string
}

export type SweepDeps = {
  notifications: {
    listNotifications(filters: Record<string, unknown>, config?: Record<string, unknown>): Promise<unknown[]>
    updateNotifications(data: { id: string; data: Record<string, unknown> }[]): Promise<unknown>
  }
  /** One attempt (lib/email/deliver). */
  deliver: (input: SendEmailInput) => Promise<SendEmailOnceResult>
  logger: Pick<Logger, "info" | "error">
}

export type SweepResult = {
  /** Went out on this run. */
  sent: number
  /** Tried on this run and failed again. */
  failed: number
  /** Given up on this run (a person was told). */
  gave_up: number
  /** Nothing left to send (e.g. the order has no address any more). */
  closed: number
  /** Not due yet. */
  waiting: number
}

type Group = { key: string; rows: Row[]; first: number; last: number }

const time = (v: Date | string) => (v instanceof Date ? v.getTime() : Date.parse(v))
const sendKeyOf = (r: Row) => {
  const key = (r.data as { send_key?: unknown } | null | undefined)?.send_key
  return typeof key === "string" && key ? key : undefined
}
const keyOf = (r: Row) => `${r.template}\n${r.resource_id}\n${r.to}\n${sendKeyOf(r) ?? ""}`
const isClosed = (r: Row) => !!(r.data as { sweep?: unknown } | null | undefined)?.sweep

/**
 * When this process last tried each email. Attempts that fail before anything
 * is stored (the order can't be loaded) would otherwise be tried on every run.
 */
const lastTried = new Map<string, number>()

export function forgetSweepAttemptsForTests() {
  lastTried.clear()
}

/** The wait before the next attempt: as long as the email has been failing, between ten minutes and four hours. */
export const sweepWaitMs = (first: number, last: number) =>
  Math.min(Math.max(last - first, SWEEP_FIRST_RETRY_AFTER_MS), SWEEP_MAX_WAIT_MS)

function inputOf(row: Row): SendEmailInput | null {
  const stored = row.data as { recipient?: unknown; ids?: unknown } | null | undefined
  const recipient = stored?.recipient
  if ((recipient !== "customer" && recipient !== "shop") || !row.template || !row.resource_id) return null
  const ids = Array.isArray(stored?.ids) ? stored.ids.filter((id): id is string => typeof id === "string") : undefined
  const sendKey = sendKeyOf(row)
  return {
    template: row.template,
    resource_id: row.resource_id,
    resource_type: row.resource_type ?? "",
    trigger_type: row.trigger_type ?? "",
    recipient,
    ...(ids ? { ids } : {}),
    ...(sendKey ? { send_key: sendKey } : {}),
  }
}

async function listAll(deps: SweepDeps, filters: Record<string, unknown>): Promise<Row[]> {
  const rows: Row[] = []
  for (let skip = 0; skip < MAX_ROWS; skip += PAGE) {
    const page = (await deps.notifications.listNotifications(filters, {
      select: ["id", "to", "template", "resource_id", "resource_type", "trigger_type", "status", "data", "created_at"],
      order: { created_at: "ASC" },
      skip,
      take: PAGE,
    })) as Row[]
    rows.push(...page)
    if (page.length < PAGE) break
  }
  return rows
}

export async function sweepFailedEmails(deps: SweepDeps, now: Date): Promise<SweepResult> {
  const result: SweepResult = { sent: 0, failed: 0, gave_up: 0, closed: 0, waiting: 0 }
  const nowMs = now.getTime()
  const since = new Date(nowMs - LOOKBACK_MS)

  // "pending" is a send that was cut off (the worker stopped mid-send): nothing will finish it.
  const unsent = (
    await listAll(deps, { channel: "email", status: ["failure", "pending"], created_at: { $gte: since } })
  ).filter((r) => !NEVER_RESENT.has(r.template ?? ""))
  if (!unsent.length) return result

  const sent = new Set(
    (
      await listAll(deps, {
        channel: "email",
        status: "success",
        resource_id: [...new Set(unsent.map((r) => r.resource_id).filter(Boolean))],
        created_at: { $gte: since },
      })
    ).map(keyOf)
  )

  const groups = new Map<string, Group>()
  for (const r of unsent) {
    const key = keyOf(r)
    if (sent.has(key)) continue
    const at = time(r.created_at)
    const g = groups.get(key)
    if (g) {
      g.rows.push(r)
      g.first = Math.min(g.first, at)
      g.last = Math.max(g.last, at)
    } else {
      groups.set(key, { key, rows: [r], first: at, last: at })
    }
  }

  const close = async (g: Group, outcome: "gave_up" | "nothing_to_send") => {
    const newest = g.rows[g.rows.length - 1]
    await deps.notifications.updateNotifications([
      { id: newest.id, data: { ...(newest.data ?? {}), sweep: { outcome, at: now.toISOString() } } },
    ])
  }
  const giveUp = async (g: Group, why: string) => {
    const r = g.rows[g.rows.length - 1]
    // Ids only: never the address.
    const message =
      `email-sweeper: giving up on an email (${why}): template=${r.template} ` +
      `${r.resource_type || "resource"}=${r.resource_id}. It was not sent; contact the recipient another way.`
    deps.logger.error(message)
    reportAlert(message, {
      source: "job:email-sweeper",
      template: r.template ?? undefined,
      resource_type: r.resource_type ?? undefined,
      resource_id: r.resource_id ?? undefined,
      audience: typeof r.data?.recipient === "string" ? r.data.recipient : undefined,
    })
    // Told first, noted second: if the note fails, the next run tells again rather than never.
    await close(g, "gave_up")
    result.gave_up++
  }

  let open = 0
  let attempts = 0
  let failuresInARow = 0
  for (const g of [...groups.values()].sort((a, b) => a.first - b.first)) {
    if (g.rows.some(isClosed)) continue
    try {
      const input = inputOf(g.rows[g.rows.length - 1])
      if (!input) {
        await giveUp(g, "nothing was stored to build it again")
        continue
      }
      const last = Math.max(g.last, lastTried.get(g.key) ?? 0)
      const lastChance = nowMs - g.first >= SWEEP_GIVE_UP_AFTER_MS
      const due = nowMs - last >= (lastChance ? SWEEP_FIRST_RETRY_AFTER_MS : sweepWaitMs(g.first, last))
      if (!due || attempts >= MAX_ATTEMPTS_PER_RUN || failuresInARow >= STOP_AFTER_FAILURES_IN_A_ROW) {
        if (due) open++
        else result.waiting++
        continue
      }

      attempts++
      lastTried.set(g.key, nowMs)
      try {
        const outcome = await deps.deliver(input)
        failuresInARow = 0
        if (outcome.skipped && !outcome.id) {
          await close(g, "nothing_to_send")
          result.closed++
        } else {
          result.sent++
        }
        lastTried.delete(g.key)
      } catch (e) {
        result.failed++
        failuresInARow = isSmtpSendFailure(e) ? failuresInARow + 1 : 0
        deps.logger.error(
          `email-sweeper: attempt failed: template=${input.template} ${input.resource_type}=${input.resource_id}: ` +
            safeErrorMessage(e)
        )
        if (lastChance) {
          await giveUp(g, `still failing after ${Math.round(SWEEP_GIVE_UP_AFTER_MS / 3_600_000)} hours`)
        } else {
          open++
        }
      }
    } catch (e) {
      // One email's bookkeeping must not stop the others.
      deps.logger.error(`email-sweeper: could not handle one email: ${safeErrorMessage(e)}`)
    }
  }

  if (result.failed) {
    const outstanding = open + result.waiting
    if (outstanding) {
      const message =
        `email-sweeper: ${outstanding} email${outstanding === 1 ? " is" : "s are"} failing to send. ` +
        "Still retrying; check the mail provider (key, quota, outage)."
      deps.logger.error(message)
      reportAlert(message, { source: "job:email-sweeper" }, "email-sweeper-failing")
    }
  }
  if (result.sent || result.closed) {
    deps.logger.info(`email-sweeper: ${result.sent} sent, ${result.closed} closed with nothing to send`)
  }
  return result
}
