import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { TRADE_APPLICATION_STATUSES } from "../../../modules/trade/constants"

const toArray = (value: unknown) =>
  value === undefined || Array.isArray(value) ? value : [value]
const toInt = (value: unknown) =>
  typeof value === "string" ? parseInt(value, 10) : value

const ORDER_FIELDS = ["created_at", "updated_at", "company_name"] as const
const ORDER_VALUES = ORDER_FIELDS.flatMap((f) => [f, `-${f}`]) as [string, ...string[]]

export const AdminGetTradeApplicationsParams = z.strictObject({
  status: z.preprocess(toArray, z.array(z.enum(TRADE_APPLICATION_STATUSES)).optional()),
  limit: z.preprocess(toInt, z.number().int().min(1).max(100).default(20)),
  offset: z.preprocess(toInt, z.number().int().min(0).default(0)),
  order: z.enum(ORDER_VALUES).default("-created_at"),
})
export type AdminGetTradeApplicationsParams = z.infer<typeof AdminGetTradeApplicationsParams>

export const AdminApproveTradeApplication = z.strictObject({})
export type AdminApproveTradeApplication = z.infer<typeof AdminApproveTradeApplication>

export const AdminRejectTradeApplication = z.strictObject({
  reason: z.string().trim().min(1, "A reason is required").max(1000),
})
export type AdminRejectTradeApplication = z.infer<typeof AdminRejectTradeApplication>

export const adminTradeMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/trade-applications",
    middlewares: [validateAndTransformQuery(AdminGetTradeApplicationsParams, {})],
  },
  {
    method: ["POST"],
    matcher: "/admin/trade-applications/:id/approve",
    middlewares: [validateAndTransformBody(AdminApproveTradeApplication)],
  },
  {
    method: ["POST"],
    matcher: "/admin/trade-applications/:id/reject",
    middlewares: [validateAndTransformBody(AdminRejectTradeApplication)],
  },
]
