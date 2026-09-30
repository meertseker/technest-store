import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { PLATFORMS, SAFETY_MARKINGS } from "../../../../../modules/product-attributes/utils"

const text = z.string().trim().min(1).max(60).nullable()

export const AdminUpsertProductAttributes = z.strictObject({
  connector_a: text.optional(),
  connector_b: text.optional(),
  wattage: z.number().min(0).max(10000).nullable().optional(),
  cable_length_m: z.number().min(0).max(100).nullable().optional(),
  platform: z.array(z.enum(PLATFORMS)).optional(),
  is_addon_item: z.boolean().optional(),
  safety_marking: z.enum(SAFETY_MARKINGS).optional(),
  warranty_months: z.number().int().min(0).max(240).nullable().optional(),
  reorder_level: z.number().int().min(0).max(100000).optional(),
})
export type AdminUpsertProductAttributes = z.infer<typeof AdminUpsertProductAttributes>

export const adminProductAttributesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/products/:id/attributes",
    middlewares: [validateAndTransformBody(AdminUpsertProductAttributes)],
  },
]
