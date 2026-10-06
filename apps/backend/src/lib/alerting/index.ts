import type { SubscriberArgs } from "@medusajs/framework"
import type { MedusaContainer } from "@medusajs/framework/types"

/**
 * Telling a person that background work failed. Subscribers and scheduled jobs
 * catch their own errors (or the event bus does), so nothing reaches Sentry's
 * global handlers: without these calls the only trace is a log line.
 *
 * Off unless SENTRY_DSN is set (the SDK is not even loaded). Events go through
 * the scrubber in lib/monitoring/sentry-scrub.ts like every other event.
 *
 * Tags are ids and names only: never an address, a customer name or order
 * contents. Don't use a tag key containing "email", "name" or "token": the
 * scrubber blanks those.
 */
export type AlertTags = Record<string, string | number | boolean | undefined>

export type Alert = {
  error?: unknown
  message?: string
  tags: AlertTags
  /** Groups repeats of the same condition into one issue. */
  fingerprint?: string
}

type Sink = (alert: Alert) => void

let sink: Sink | null | undefined

function getSink(): Sink | null {
  if (sink === undefined) {
    sink = null
    if (process.env.SENTRY_DSN) {
      try {
        const Sentry = require("@sentry/node") as typeof import("@sentry/node")
        sink = ({ error, message, tags, fingerprint }) =>
          Sentry.withScope((scope) => {
            scope.setTags(tags as Record<string, string | number | boolean>)
            if (fingerprint) scope.setFingerprint([fingerprint])
            if (message !== undefined) Sentry.captureMessage(message, "error")
            else Sentry.captureException(error)
          })
      } catch {
        sink = null
      }
    }
  }
  return sink
}

/** Test hook: replace where alerts go (null = reporting off, undefined = decide from the environment again). */
export function setAlertSinkForTests(fn: Sink | null | undefined) {
  sink = fn
}

function send(alert: Alert) {
  try {
    getSink()?.(alert)
  } catch {
    // Reporting must never break the work that called it.
  }
}

/** An exception from background work. Never throws. */
export function reportError(error: unknown, tags: AlertTags) {
  send({ error, tags })
}

/** A condition someone must look at that is not an exception (e.g. "emails are failing"). Never throws. */
export function reportAlert(message: string, tags: AlertTags, fingerprint?: string) {
  send(fingerprint ? { message, tags, fingerprint } : { message, tags })
}

type Job = (container: MedusaContainer) => Promise<unknown>

/** A scheduled job whose uncaught error is reported, then rethrown for the framework to log. */
export function reportingJob(name: string, handler: Job): Job {
  return async (container) => {
    try {
      return await handler(container)
    } catch (e) {
      reportError(e, { source: `job:${name}` })
      throw e
    }
  }
}

/**
 * A subscriber whose uncaught error is reported, then rethrown so the event
 * bus retries it. `ignore` is for errors thrown on purpose to get that retry.
 */
export function reportingSubscriber<D>(
  name: string,
  handler: (args: SubscriberArgs<D>) => Promise<void>,
  options: { ignore?: (e: unknown) => boolean } = {}
) {
  const wrapped = async (args: SubscriberArgs<D>) => {
    try {
      await handler(args)
    } catch (e) {
      if (!options.ignore?.(e)) {
        reportError(e, { source: `subscriber:${name}`, event: args.event?.name })
      }
      throw e
    }
  }
  // Medusa names a subscriber after its handler function; keep that name, so
  // wrapping never changes the id the event bus tracks retries by.
  return Object.defineProperty(wrapped, "name", { value: handler.name })
}
