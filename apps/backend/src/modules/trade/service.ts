import { MedusaService } from "@medusajs/framework/utils"
import TradeApplication from "./models/trade-application"

class TradeModuleService extends MedusaService({
  TradeApplication,
}) {}

export default TradeModuleService
