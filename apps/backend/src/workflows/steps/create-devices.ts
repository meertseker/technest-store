import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DEVICE_MODULE } from "../../modules/device"
import DeviceModuleService from "../../modules/device/service"
import { DeviceType } from "../../modules/device/utils"

export type CreateDeviceData = {
  brand: string
  series: string
  model: string
  slug: string
  type: DeviceType
  aliases?: string[]
  release_year?: number | null
  image_url?: string | null
}

export const createDevicesStep = createStep(
  "create-devices",
  async (data: CreateDeviceData[], { container }) => {
    const deviceService: DeviceModuleService = container.resolve(DEVICE_MODULE)
    const devices = await deviceService.createDevices(data)
    return new StepResponse(
      devices,
      devices.map((device) => device.id)
    )
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }
    const deviceService: DeviceModuleService = container.resolve(DEVICE_MODULE)
    await deviceService.deleteDevices(ids)
  }
)
