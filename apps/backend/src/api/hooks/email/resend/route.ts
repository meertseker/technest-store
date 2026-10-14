import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { reportAlert } from "../../../../lib/alerting"
import { safeErrorMessage } from "../../../../lib/email/safe-error"

/** The two events that mean an email we recorded as sent never reached, or upset, its reader. */
const REPORTED = new Set(["email.bounced", "email.complained"])

/** How far back a stored attempt is matched to the event. */
const MATCH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

type ResendEvent = {
  type?: unknown
  data?: {
    email_id?: unknown
    to?: unknown
    bounce?: { type?: unknown; subType?: unknown } | null
  } | null
}

const str = (v: unknown) => (typeof v === "string" ? v : undefined)

/**
 * POST /hooks/email/resend (signature checked in middlewares.ts).
 *
 * "success" on a stored attempt only means the mail server accepted the
 * message. Resend tells us here when the recipient's server later bounced
 * it or the reader marked it as spam. Each such event becomes a Sentry
 * alert carrying the ids of the stored attempt it matches (by recipient,
 * newest within 30 days): the person on call then knows which order or
 * application's email did not arrive and can reach the customer another
 * way. Addresses and subjects are never logged or tagged.
 */
export async function POST(req: MedusaRequest<ResendEvent>, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const type = str(req.body?.type)
  if (!type || !REPORTED.has(type)) {
    res.status(200).json({ received: true })
    return
  }

  const data = req.body?.data ?? {}
  const recipients = (Array.isArray(data?.to) ? data.to : [data?.to]).filter((t): t is string => typeof t === "string" && !!t)
  const tags: Record<string, string | undefined> = {
    source: "webhook:resend",
    event: type,
    resend_id: str(data?.email_id),
    bounce_type: str(data?.bounce?.type),
    bounce_subtype: str(data?.bounce?.subType),
  }

  try {
    if (recipients.length) {
      const notifications = req.scope.resolve(Modules.NOTIFICATION)
      // `status` is a column of the notification table but not part of the
      // published filter type (the sweeper filters on it the same way).
      const filters: Record<string, unknown> = {
        to: recipients,
        channel: "email",
        status: "success",
        created_at: { $gte: new Date(Date.now() - MATCH_WINDOW_MS) },
      }
      const [match] = await notifications.listNotifications(
        filters as Parameters<typeof notifications.listNotifications>[0],
        { select: ["id", "template", "resource_type", "resource_id"], order: { created_at: "DESC" }, take: 1 }
      )
      if (match) {
        tags.notification_id = match.id
        tags.template = match.template ?? undefined
        tags.resource_type = match.resource_type ?? undefined
        tags.resource_id = match.resource_id ?? undefined
      }
    }
  } catch (e) {
    // The alert still goes out, just without the match.
    logger.warn(`Resend webhook: could not match the event to a stored attempt: ${safeErrorMessage(e)}`)
  }

  const what = type === "email.bounced" ? "bounced" : "was marked as spam"
  const about = tags.notification_id
    ? `notification=${tags.notification_id} template=${tags.template} ${tags.resource_type || "resource"}=${tags.resource_id}`
    : "no stored attempt matched"
  const message = `Resend: an email ${what} (${about}). It did not reach the recipient; contact them another way.`
  logger.warn(message)
  reportAlert(message, tags)
  res.status(200).json({ received: true })
}
