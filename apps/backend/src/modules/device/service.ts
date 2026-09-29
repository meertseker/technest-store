import { MedusaService } from "@medusajs/framework/utils"
import Device from "./models/device"

class DeviceModuleService extends MedusaService({
  Device,
}) {}

export default DeviceModuleService
