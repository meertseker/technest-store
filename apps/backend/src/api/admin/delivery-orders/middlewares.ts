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

/** No body: the button carries nothing. */
export const AdminPostDeliveryOrderShipped = z.strictObject({})

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
