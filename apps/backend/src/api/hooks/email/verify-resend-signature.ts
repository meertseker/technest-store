import { createHmac, timingSafeEqual } from "node:crypto"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/** Svix's default: events signed more than 5 minutes ago (or in the future) are replays. */
export const RESEND_SIGNATURE_TOLERANCE_SECONDS = 300

type SvixHeaders = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/**
 * Resend signs webhooks through Svix (docs.svix.com/receiving/verifying-payloads/how-manual):
 * `svix-signature: v1,<base64> [v1,<base64> ...]`, each being
 * HMAC-SHA256(key, `${svix-id}.${svix-timestamp}.${rawBody}`) in base64, where key is the
 * base64-decoded part of the secret after `whsec_`. True only for an exact match on the
 * raw body within the tolerance window. Constant-time comparison, no dependency.
 */
export function isValidSvixSignature(
  rawBody: Buffer | string,
  headers: SvixHeaders,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = RESEND_SIGNATURE_TOLERANCE_SECONDS
): boolean {
  const id = first(headers["svix-id"])
  const timestamp = first(headers["svix-timestamp"])
  const signatures = first(headers["svix-signature"])
  if (!id || !timestamp || !signatures || !secret.startsWith("whsec_")) return false
  const key = Buffer.from(secret.slice("whsec_".length), "base64")
  if (!key.length) return false
  const ts = Number(timestamp)
  if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > toleranceSeconds) return false

  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.`, "utf8")
    .update(typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody)
    .digest()
  return signatures.split(" ").some((entry) => {
    const [version, value] = entry.split(",", 2)
    if (version !== "v1" || !value) return false
    const given = Buffer.from(value, "base64")
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

/**
 * POST /hooks/email/resend: 503 until RESEND_WEBHOOK_SECRET is set (so a
 * forgotten secret shows up in Resend's delivery log rather than as silently
 * accepted events), 400 for a missing or wrong signature. Verification uses
 * the raw body preserved for this path; nothing from the request is logged.
 */
export function verifyResendWebhookSignature(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim() ?? ""
  if (!secret) {
    logger.warn("Resend webhook refused: RESEND_WEBHOOK_SECRET is not set")
    res.status(503).json({ type: "not_configured", message: "Email webhook is not configured" })
    return
  }
  const raw = (req as MedusaRequest & { rawBody?: Buffer | string }).rawBody
  if (raw === undefined || !isValidSvixSignature(raw, req.headers, secret)) {
    logger.warn("Resend webhook rejected: missing or invalid signature")
    res.status(400).json({ type: "invalid_data", message: "Invalid webhook signature" })
    return
  }
  next()
}
