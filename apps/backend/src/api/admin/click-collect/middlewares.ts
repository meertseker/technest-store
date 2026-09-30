import { MiddlewareRoute, validateAndTransformQuery } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { COLLECT_STATUSES } from "../../../lib/click-collect"

const toInt = (value: unknown) => (typeof value === "string" ? parseInt(value, 10) : value)

export const AdminGetClickCollectOrdersParams = z.strictObject({
  status: z.enum(COLLECT_STATUSES),
  limit: z.preprocess(toInt, z.number().int().min(1).max(100).default(50)),
  offset: z.preprocess(toInt, z.number().int().min(0).default(0)),
})
export type AdminGetClickCollectOrdersParams = z.infer<typeof AdminGetClickCollectOrdersParams>

export const adminClickCollectMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/click-collect/orders",
    middlewares: [validateAndTransformQuery(AdminGetClickCollectOrdersParams, {})],
  },
]
