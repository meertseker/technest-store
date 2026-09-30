import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { ATTRIBUTE_KEYS } from "../../../modules/product-attributes/utils"

/**
 * Store product routes only return fields on an allow-list and silently drop
 * the rest, so the product_attributes link has to be allowed explicitly
 * (`fields=+product_attributes.*` or single keys, docs/contracts/product-attributes.md).
 * Must run before the core route's query validation: core middlewares load
 * first, and among equal matchers they keep that order, so the matcher is a
 * wildcard (sorted ahead of static and param matchers). Covers
 * /store/products and /store/products/:id.
 */
export const STORE_PRODUCT_ATTRIBUTE_FIELDS = [
  "product_attributes",
  ...ATTRIBUTE_KEYS.map((key) => `product_attributes.${key}`),
]

export function allowProductAttributeFields(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  ;(req.allowed ??= []).push(...STORE_PRODUCT_ATTRIBUTE_FIELDS)
  next()
}

export const storeProductMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/products*",
    middlewares: [allowProductAttributeFields],
  },
]
