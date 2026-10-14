import { model } from "@medusajs/framework/utils"

/**
 * One row per remembered id of a Medusa record the shop depends on (the Trade
 * customer group, the Trade price list), so it is found by id rather than by
 * a display name staff can change. `value` is the record id.
 */
const TechnestReference = model
  .define("technest_reference", {
    id: model.id({ prefix: "tnref" }).primaryKey(),
    key: model.text(),
    value: model.text(),
  })
  .indexes([
    {
      on: ["key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default TechnestReference
