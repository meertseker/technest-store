import type { Logger } from "@medusajs/framework/types"

/**
 * Worker heartbeat for an external dead-man's switch (healthchecks.io,
 * Better Stack, UptimeRobot heartbeat ...): a monitor that raises an alarm
 * when the pings STOP.
 *
 * Every 5 minutes the worker-heartbeat job emits HEARTBEAT_EVENT and the
 * subscriber of that event requests WORKER_HEARTBEAT_URL. So a ping means
 * the scheduler ran a job, the event reached the queue, and the event worker
 * took it off again: the same path an order's payment capture and emails
 * take. A worker that is down, or stuck behind one event, goes quiet, which
 * /health (a fixed 200 from the server process) can never show.
 *
 * Does nothing when WORKER_HEARTBEAT_URL is unset.
 */
export const HEARTBEAT_EVENT = "technest.worker.heartbeat"

/** The ping URL, or null when unset or not an http(s) URL. */
export function heartbeatUrl(env: Record<string, string | undefined> = process.env): string | null {
  const url = env.WORKER_HEARTBEAT_URL?.trim()
  return url && /^https?:\/\/\S+$/i.test(url) ? url : null
}

/**
 * One ping. Never throws, and never logs the URL: whoever knows it can keep
 * the monitor quiet.
 */
export async function pingHeartbeat(
  url: string,
  logger: Pick<Logger, "warn">,
  timeoutMs = 10_000
): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) {
      logger.warn(`worker-heartbeat: the monitor answered ${res.status}`)
      return false
    }
    return true
  } catch (e) {
    logger.warn(`worker-heartbeat: the ping did not get through (${(e as Error)?.name ?? "error"})`)
    return false
  }
}
