import { Module } from "@medusajs/framework/utils"
import ProductAttributesModuleService from "./service"

export const PRODUCT_ATTRIBUTES_MODULE = "productAttributes"

export default Module(PRODUCT_ATTRIBUTES_MODULE, {
  service: ProductAttributesModuleService,
})
