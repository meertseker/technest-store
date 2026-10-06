import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { MAX_PRICE_GBP } from "../../../../../lib/product-import/rows"

/** The same ceiling the import uses: a slip like 49900 for 4.99 is refused, not published. */
export const MAX_PRICE_PENCE = MAX_PRICE_GBP * 100

/**
 * Price in integer pence (VAT included) and/or stock at the shop; at least one.
 * `expected_stock` is the stock the page showed (null = none yet): when it is
 * sent and no longer true, the request is refused instead of overwriting.
 */
export const AdminPostVariantPriceStock = z
  .strictObject({
    price_pence: z.number().int().min(1).max(MAX_PRICE_PENCE).optional(),
    stock: z.number().int().min(0).max(100_000).optional(),
    expected_stock: z.number().int().min(0).nullable().optional(),
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
