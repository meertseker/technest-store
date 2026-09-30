import { model } from "@medusajs/framework/utils"
import { DEFAULT_REORDER_LEVEL, SAFETY_MARKINGS } from "../utils"

/** One row per product (ADR 0001). A missing row means all defaults. */
const ProductAttributes = model.define("product_attributes", {
  id: model.id({ prefix: "pattr" }).primaryKey(),
  connector_a: model.text().nullable(),
  connector_b: model.text().nullable(),
  wattage: model.float().nullable(),
  cable_length_m: model.float().nullable(),
  platform: model.array().default([]),
  is_addon_item: model.boolean().default(false),
  safety_marking: model.enum([...SAFETY_MARKINGS]).default("none"),
  warranty_months: model.number().nullable(),
  reorder_level: model.number().default(DEFAULT_REORDER_LEVEL),
})

export default ProductAttributes
