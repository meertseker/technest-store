import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DEVICE_MODULE } from "../../modules/device"
import DeviceModuleService from "../../modules/device/service"

export const deleteDevicesStep = createStep(
  "delete-devices",
  async (ids: string[], { container }) => {
    const deviceService: DeviceModuleService = container.resolve(DEVICE_MODULE)
    const found = await deviceService.listDevices({ id: ids }, { select: ["id"] })
    const missing = ids.find((id) => !found.some((device) => device.id === id))
    if (missing) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Device with id: ${missing} was not found`
      )
    }
    await deviceService.softDeleteDevices(ids)
    return new StepResponse(ids, ids)
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }
    const deviceService: DeviceModuleService = container.resolve(DEVICE_MODULE)
    await deviceService.restoreDevices(ids)
  }
)
