import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { rateLimit, SlidingWindowRateLimiter } from "../../../lib/rate-limit"
import { PHONE_PATTERN } from "../trade-applications/middlewares"

export const StoreCreateRepairBooking = z.strictObject({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().regex(PHONE_PATTERN, "Enter a valid phone number"),
  email: z.email().max(320),
  device: z.string().trim().min(1).max(200),
  device_id: z.string().min(1).nullable().optional(),
  fault: z.string().trim().min(1).max(2000),
  preferred_time: z.string().trim().min(1).max(200),
  turnstile_token: z.string().min(1).max(4096),
})
export type StoreCreateRepairBooking = z.infer<typeof StoreCreateRepairBooking>

/** 5 booking attempts per 10 minutes per client IP (docs/contracts/repairs.md). */
export const repairBookingLimiter = new SlidingWindowRateLimiter({
  limit: 5,
  windowMs: 10 * 60 * 1000,
})

export const storeRepairMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/repair-bookings",
    middlewares: [
      rateLimit(
        repairBookingLimiter,
        "repair-bookings",
        "Too many repair bookings, please try again later"
      ),
      validateAndTransformBody(StoreCreateRepairBooking),
    ],
  },
]
