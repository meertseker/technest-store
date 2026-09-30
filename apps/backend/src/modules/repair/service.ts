import { MedusaService } from "@medusajs/framework/utils"
import RepairBooking from "./models/repair-booking"

class RepairModuleService extends MedusaService({
  RepairBooking,
}) {}

export default RepairModuleService
