import { MedusaService } from "@medusajs/framework/utils"
import TechnestReference from "./models/technest-reference"
import TechnestSetting from "./models/technest-setting"

class SettingsModuleService extends MedusaService({
  TechnestSetting,
  TechnestReference,
}) {}

export default SettingsModuleService
