import { MiddlewareRoute, validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DELIVERY_STATUSES } from "../../../lib/delivery"

const toInt = (value: unknown) => (typeof value === "string" ? parseInt(value, 10) : value)

export const AdminGetDeliveryOrdersParams = z.strictObject({
  status: z.enum(DELIVERY_STATUSES),
  limit: z.preprocess(toInt, z.number().int().min(1).max(50).default(20)),
  offset: z.preprocess(toInt, z.number().int().min(0).default(0)),
})
export type AdminGetDeliveryOrdersParams = z.infer<typeof AdminGetDeliveryOrdersParams>

/**
 * Optional tracking, typed by the shop in the "Packed & shipped" dialog and shown in the
 * customer's "on its way" email. Only http(s) links: the email renders the link as given.
 */
export const AdminPostDeliveryOrderShipped = z
  .strictObject({
    tracking_number: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9 -]{1,64}$/, "A tracking number has only letters, numbers, spaces and dashes (up to 64).")
      .optional(),
    tracking_url: z
      .string()
      .trim()
      .max(500)
      .regex(/^https?:\/\/\S+$/i, "The tracking link must start with https://.")
      .optional(),
  })
  .refine((b) => !b.tracking_url || !!b.tracking_number, {
    message: "Add the tracking number as well, or leave the link out.",
  })
export type AdminPostDeliveryOrderShipped = z.infer<typeof AdminPostDeliveryOrderShipped>

export const adminDeliveryOrdersMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/delivery-orders",
    middlewares: [validateAndTransformQuery(AdminGetDeliveryOrdersParams, {})],
  },
  {
    method: ["POST"],
    matcher: "/admin/delivery-orders/:id/shipped",
    middlewares: [validateAndTransformBody(AdminPostDeliveryOrderShipped)],
  },
]
