import { MedusaService } from "@medusajs/framework/utils"
import TechnestSetting from "./models/technest-setting"

class SettingsModuleService extends MedusaService({
  TechnestSetting,
}) {}

export default SettingsModuleService
