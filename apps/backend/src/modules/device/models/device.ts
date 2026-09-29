import { model } from "@medusajs/framework/utils"
import { DEVICE_TYPES } from "../utils"

const Device = model
  .define("device", {
    id: model.id({ prefix: "dev" }).primaryKey(),
    brand: model.text(),
    series: model.text(),
    model: model.text(),
    slug: model.text().unique(),
    aliases: model.array().default([]),
    type: model.enum([...DEVICE_TYPES]),
    release_year: model.number().nullable(),
    image_url: model.text().nullable(),
  })
  .indexes([{ on: ["brand", "series"] }])

export default Device
