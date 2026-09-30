import {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { SlidingWindowRateLimiter } from "../../../lib/rate-limit"
import { PRICE_MAX_GBP, PRODUCT_TYPES, TITLE_MAX, DESCRIPTION_MAX } from "../../../lib/quick-add/suggestion"
import { SAFETY_MARKINGS } from "../../../modules/product-attributes/utils"

/** A File Module key (as returned by POST /admin/uploads): no absolute paths, "..", or backslashes. */
const FileId = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine((id) => !id.startsWith("/") && !id.includes("\\") && !id.split("/").includes(".."), {
    message: "Invalid file id",
  })

export const AdminQuickAddAnalyze = z.strictObject({ file_id: FileId })
export type AdminQuickAddAnalyze = z.infer<typeof AdminQuickAddAnalyze>

const ShortText = z.string().trim().max(60).nullable()

export const AdminQuickAddCreate = z.strictObject({
  title: z.string().trim().min(1, "Enter a title.").max(TITLE_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).optional(),
  category_id: z.string().trim().min(1).optional(),
  product_type: z.enum(PRODUCT_TYPES).optional(),
  device_ids: z.array(z.string().trim().min(1)).max(100).optional(),
  // Major units incl. VAT (GBP 12.99 = 12.99), at most 2 decimals.
  price: z
    .number()
    .positive("Enter a price above 0.")
    .max(PRICE_MAX_GBP)
    .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, {
      message: "Use at most 2 decimals (e.g. 12.99).",
    }),
  sku: z.string().trim().min(1).max(64).optional(),
  stock: z.number().int().min(0).max(100_000).optional(),
  safety_marking: z.enum(SAFETY_MARKINGS),
  safety_marking_confirmed: z.boolean().optional(),
  attributes: z
    .strictObject({
      connector_a: ShortText.optional(),
      connector_b: ShortText.optional(),
      wattage: z.number().positive().max(500).nullable().optional(),
      cable_length_m: z.number().positive().max(20).nullable().optional(),
      is_addon_item: z.boolean().optional(),
    })
    .optional(),
  photo_file_id: FileId.optional(),
  ai_assisted: z.boolean().optional(),
})
export type AdminQuickAddCreate = z.infer<typeof AdminQuickAddCreate>

const DEFAULT_AI_LIMIT_PER_HOUR = 60

function aiLimitPerHour() {
  const n = Number(process.env.QUICK_ADD_AI_LIMIT_PER_HOUR)
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_AI_LIMIT_PER_HOUR
}

let limiter: SlidingWindowRateLimiter | null = null

/**
 * Per admin user: every analysis is a paid Claude call. Created on first use
 * so QUICK_ADD_AI_LIMIT_PER_HOUR is read after the environment is loaded.
 */
export function quickAddAiLimiter() {
  limiter ??= new SlidingWindowRateLimiter({ limit: aiLimitPerHour(), windowMs: 60 * 60 * 1000 })
  return limiter
}

/** Tests: forget all hits and re-read the limit. */
export function resetQuickAddAiLimiter() {
  limiter = null
}

export function limitAiPerUser(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const { allowed, retryAfterSeconds } = quickAddAiLimiter().hit(
    `quick-add-ai:${req.auth_context.actor_id}`
  )
  if (!allowed) {
    res.setHeader("Retry-After", String(retryAfterSeconds))
    res.status(429).json({
      type: "too_many_requests",
      message: `Too many photo analyses. Try again in ${Math.ceil(retryAfterSeconds / 60)} min, or fill in the details yourself.`,
    })
    return
  }
  next()
}

export const adminQuickAddMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/quick-add/analyze",
    middlewares: [validateAndTransformBody(AdminQuickAddAnalyze), limitAiPerUser as any],
  },
  {
    method: ["POST"],
    matcher: "/admin/quick-add",
    middlewares: [validateAndTransformBody(AdminQuickAddCreate)],
  },
]
