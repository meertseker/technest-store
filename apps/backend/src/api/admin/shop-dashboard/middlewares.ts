import { MiddlewareRoute, validateAndTransformQuery } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

const toInt = (value: unknown) => (typeof value === "string" ? parseInt(value, 10) : value)

/** Today, the last 7, 30 or 90 London days. */
export const AdminGetShopDashboardParams = z.strictObject({
  days: z.preprocess(toInt, z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]).default(7)),
})
export type AdminGetShopDashboardParams = z.infer<typeof AdminGetShopDashboardParams>

export const adminShopDashboardMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/shop-dashboard",
    middlewares: [validateAndTransformQuery(AdminGetShopDashboardParams, {})],
  },
]
