import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import ProductAttributesModule from "../modules/product-attributes"

// One-to-one: product.product_attributes. Deleting a product deletes its row.
export default defineLink(ProductModule.linkable.product, {
  linkable: ProductAttributesModule.linkable.productAttributes,
  deleteCascade: true,
})
