import { MedusaContainer } from "@medusajs/framework"
import { ensureOneAttributesRowPerProduct } from "../lib/product-attributes-unique"

/**
 * Runs once per database, after the link sync: the database itself allows only
 * one live attributes row per product (see lib/product-attributes-unique.ts).
 */
export default async function product_attributes_unique({
  container,
}: {
  container: MedusaContainer
}) {
  await ensureOneAttributesRowPerProduct(container)
}
