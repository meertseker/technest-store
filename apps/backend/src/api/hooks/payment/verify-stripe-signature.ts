import { createHmac, timingSafeEqual } from "crypto"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/** Stripe's default: events signed more than 5 minutes ago are replays. */
export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300

/**
 * Stripe's documented v1 scheme: `Stripe-Signature: t=<unix>,v1=<hex>[,v1=...]`,
 * where v1 = HMAC-SHA256(secret, `${t}.${rawBody}`). Returns true only for an
 * exact match within the tolerance window. Constant-time comparison.
 */
export function isValidStripeSignature(
  rawBody: Buffer | string,
  header: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = STRIPE_SIGNATURE_TOLERANCE_SECONDS
): boolean {
  if (!header || !secret) return false
  let timestamp = NaN
  const signatures: string[] = []
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2).map((s) => s?.trim())
    if (key === "t") timestamp = Number(value)
    if (key === "v1" && value) signatures.push(value)
  }
  if (!Number.isInteger(timestamp) || !signatures.length) return false
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.`, "utf8")
    .update(typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody)
    .digest()
  return signatures.some((hex) => {
    const given = Buffer.from(hex, "hex")
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

/**
 * POST /hooks/payment/stripe_stripe: reject unsigned or wrongly signed
 * requests with 400 before Medusa queues them. Medusa's stock route answers
 * 200 to anything and only verifies the signature later in the worker (with
 * Stripe's library, which still runs: this is the first of two checks).
 * Verification uses the raw body Medusa preserves for this path; a parsed and
 * re-serialised body would never match. Nothing from the request is logged.
 */
export function verifyStripeWebhookSignature(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? ""
  const raw = (req as MedusaRequest & { rawBody?: Buffer | string }).rawBody
  const header = req.headers["stripe-signature"]
  const ok =
    raw !== undefined &&
    typeof header === "string" &&
    isValidStripeSignature(raw, header, secret)
  if (!ok) {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        secret
          ? "Stripe webhook rejected: missing or invalid signature"
          : "Stripe webhook rejected: STRIPE_WEBHOOK_SECRET is not set"
      )
    res.status(400).json({ type: "invalid_data", message: "Invalid webhook signature" })
    return
  }
  next()
}
