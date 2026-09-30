import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { REPAIR_BOOKING_STATUSES } from "../../../modules/repair/constants"

const toArray = (value: unknown) =>
  value === undefined || Array.isArray(value) ? value : [value]
const toInt = (value: unknown) =>
  typeof value === "string" ? parseInt(value, 10) : value

const ORDER_FIELDS = ["created_at", "updated_at"] as const
const ORDER_VALUES = ORDER_FIELDS.flatMap((f) => [f, `-${f}`]) as [string, ...string[]]

export const AdminGetRepairBookingsParams = z.strictObject({
  status: z.preprocess(toArray, z.array(z.enum(REPAIR_BOOKING_STATUSES)).optional()),
  limit: z.preprocess(toInt, z.number().int().min(1).max(100).default(20)),
  offset: z.preprocess(toInt, z.number().int().min(0).default(0)),
  order: z.enum(ORDER_VALUES).default("-created_at"),
})
export type AdminGetRepairBookingsParams = z.infer<typeof AdminGetRepairBookingsParams>

export const AdminUpdateRepairBooking = z
  .strictObject({
    status: z.enum(REPAIR_BOOKING_STATUSES).optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .refine((body) => body.status !== undefined || body.notes !== undefined, {
    message: "Send status and/or notes",
  })
export type AdminUpdateRepairBooking = z.infer<typeof AdminUpdateRepairBooking>

export const adminRepairMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/repair-bookings",
    middlewares: [validateAndTransformQuery(AdminGetRepairBookingsParams, {})],
  },
  {
    method: ["POST"],
    matcher: "/admin/repair-bookings/:id",
    middlewares: [validateAndTransformBody(AdminUpdateRepairBooking)],
  },
]
