import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, PaymentWebhookEvents } from "@medusajs/framework/utils"
import { isValidStripeSignature } from "../api/hooks/payment/verify-stripe-signature"
import { reportingSubscriber } from "../lib/alerting"
import { handleStripeEvent, STRIPE_EVENT_TOLERANCE_SECONDS, type StripeEvent } from "../lib/stripe-events"

type SerialisedBuffer = { type: "Buffer"; data: number[] }

/** What Medusa's webhook route queues (its own subscriber consumes the same event). */
type WebhookReceived = {
  provider: string
  payload: {
    data?: unknown
    rawData?: Buffer | string | SerialisedBuffer
    headers?: Record<string, unknown>
  }
}

/**
 * payment.webhook_received (Stripe) → disputes, dashboard refunds and holds
 * released at Stripe. Medusa's own handler acts only on the intent events
 * that authorise or capture; everything else it drops, so these would never
 * reach the order, Sentry or the shop.
 *
 * The route already verified the signature before queueing; the queued copy
 * is verified again here (an event bus is not a trust boundary) with a longer
 * tolerance, because the worker may run it long after Stripe sent it.
 */
async function stripeEvents({ event: { data }, container }: SubscriberArgs<WebhookReceived>) {
  if (data?.provider !== "stripe_stripe") return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  let raw = data.payload?.rawData
  if (raw && typeof raw === "object" && !Buffer.isBuffer(raw) && raw.type === "Buffer") {
    raw = Buffer.from(raw.data)
  }
  const header = data.payload?.headers?.["stripe-signature"]
  const valid =
    raw !== undefined &&
    typeof header === "string" &&
    isValidStripeSignature(
      raw as Buffer | string,
      header,
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
      Math.floor(Date.now() / 1000),
      STRIPE_EVENT_TOLERANCE_SECONDS
    )
  if (!valid) {
    logger.warn("stripe-events: a queued webhook did not verify; ignored")
    return
  }

  let event: StripeEvent
  try {
    event = JSON.parse(typeof raw === "string" ? raw : (raw as Buffer).toString("utf8"))
  } catch {
    logger.warn("stripe-events: a queued webhook was not JSON; ignored")
    return
  }
  if (!event || typeof event.type !== "string" || !event.data?.object || typeof event.data.object !== "object") return

  const { handled } = await handleStripeEvent(container, event)
  if (handled) logger.info(`stripe-events: ${event.type} ${event.id}: ${handled}`)
}

export default reportingSubscriber("stripe-events", stripeEvents)

export const config: SubscriberConfig = {
  event: PaymentWebhookEvents.WebhookReceived,
  context: { subscriberId: "technest-stripe-events" },
}
