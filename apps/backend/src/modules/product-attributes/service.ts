import { MedusaService } from "@medusajs/framework/utils"
import ProductAttributes from "./models/product-attributes"

class ProductAttributesModuleService extends MedusaService({
  ProductAttributes,
}) {}

export default ProductAttributesModuleService
