import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

/** Price in integer pence (VAT included) and/or stock at the shop; at least one. */
export const AdminPostVariantPriceStock = z
  .strictObject({
    price_pence: z.number().int().min(1).optional(),
    stock: z.number().int().min(0).max(100_000).optional(),
  })
  .refine((b) => b.price_pence !== undefined || b.stock !== undefined, {
    message: "Give a price or a stock level",
  })
export type AdminPostVariantPriceStock = z.infer<typeof AdminPostVariantPriceStock>

export const adminVariantPriceStockMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/products/:id/variants/:variant_id/price-stock",
    middlewares: [validateAndTransformBody(AdminPostVariantPriceStock)],
  },
]
