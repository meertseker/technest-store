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
/** Attributes that are the shop's own business, never shown to shoppers. */
export const PRIVATE_ATTRIBUTE_KEYS: readonly string[] = ["reorder_level"]

export const STORE_PRODUCT_ATTRIBUTE_FIELDS = [
  "product_attributes",
  ...ATTRIBUTE_KEYS.filter((key) => !PRIVATE_ATTRIBUTE_KEYS.includes(key)).map(
    (key) => `product_attributes.${key}`
  ),
]

export function allowProductAttributeFields(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  ;(req.allowed ??= []).push(...STORE_PRODUCT_ATTRIBUTE_FIELDS)
  next()
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v)

function scrubProduct(product: unknown) {
  if (!isRecord(product) || !isRecord(product.product_attributes)) return product
  const attributes = { ...product.product_attributes }
  for (const key of PRIVATE_ATTRIBUTE_KEYS) delete attributes[key]
  return { ...product, product_attributes: attributes }
}

/**
 * A store product response without the private attributes. The allow-list
 * above stops `fields=product_attributes.reorder_level`, but a wildcard
 * (`+product_attributes.*`, `*product_attributes`) expands to every column, so
 * the body is cleaned as well. `{ product }` and `{ products }` shapes only.
 */
export function scrubPrivateAttributes<T>(body: T): T {
  if (!isRecord(body)) return body
  if ("product" in body) return { ...body, product: scrubProduct(body.product) } as T
  if (Array.isArray(body.products)) return { ...body, products: body.products.map(scrubProduct) } as T
  return body
}

/** Wraps res.json so every store product listing goes through scrubPrivateAttributes. */
export function hidePrivateAttributes(
  _req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const json = res.json.bind(res)
  res.json = ((body: unknown) => json(scrubPrivateAttributes(body))) as typeof res.json
  next()
}

export const storeProductMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/products*",
    middlewares: [allowProductAttributeFields, hidePrivateAttributes],
  },
]
