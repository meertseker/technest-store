import { model } from "@medusajs/framework/utils"
import { REPAIR_BOOKING_STATUSES } from "../constants"

const RepairBooking = model
  .define("repair_booking", {
    id: model.id({ prefix: "rep" }).primaryKey(),
    name: model.text(),
    phone: model.text(),
    email: model.text(),
    device: model.text(),
    device_id: model.text().nullable(),
    fault: model.text(),
    preferred_time: model.text(),
    status: model.enum([...REPAIR_BOOKING_STATUSES]).default("new"),
    notes: model.text().nullable(),
  })
  .indexes([{ on: ["status"] }])

export default RepairBooking
