import { model } from "@medusajs/framework/utils"

/**
 * One row per saved setting (docs/contracts/settings.md). A missing row means
 * the default applies. `value` is integer pence.
 */
const TechnestSetting = model
  .define("technest_setting", {
    id: model.id({ prefix: "tnset" }).primaryKey(),
    key: model.text(),
    value: model.number(),
  })
  .indexes([
    {
      on: ["key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default TechnestSetting
