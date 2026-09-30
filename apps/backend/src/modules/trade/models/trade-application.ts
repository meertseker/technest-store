import { model } from "@medusajs/framework/utils"
import { BUSINESS_TYPES, TRADE_APPLICATION_STATUSES } from "../constants"

const TradeApplication = model
  .define("trade_application", {
    id: model.id({ prefix: "tapp" }).primaryKey(),
    customer_id: model.text(),
    company_name: model.text(),
    vat_number: model.text().nullable(),
    companies_house_number: model.text().nullable(),
    business_type: model.enum([...BUSINESS_TYPES]),
    contact_name: model.text(),
    contact_phone: model.text(),
    contact_email: model.text(),
    status: model.enum([...TRADE_APPLICATION_STATUSES]).default("pending"),
    reason: model.text().nullable(),
  })
  .indexes([
    { on: ["status"] },
    // One pending application per customer, enforced by the database as well.
    { on: ["customer_id"], unique: true, where: "status = 'pending'" },
    { on: ["customer_id", "created_at"] },
  ])

export default TradeApplication
