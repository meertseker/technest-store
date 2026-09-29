import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DEVICE_MODULE } from "../../modules/device"
import DeviceModuleService from "../../modules/device/service"
import { CreateDeviceData } from "./create-devices"

export type UpdateDeviceData = { id: string } & Partial<CreateDeviceData>

const UPDATABLE = [
  "brand",
  "series",
  "model",
  "slug",
  "type",
  "aliases",
  "release_year",
  "image_url",
] as const

export const updateDeviceStep = createStep(
  "update-device",
  async (data: UpdateDeviceData, { container }) => {
    const deviceService: DeviceModuleService = container.resolve(DEVICE_MODULE)
    const previous = await deviceService.retrieveDevice(data.id, {
      select: ["id", ...UPDATABLE],
    })
    const device = await deviceService.updateDevices(data)
    return new StepResponse(device, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const deviceService: DeviceModuleService = container.resolve(DEVICE_MODULE)
    await deviceService.updateDevices(previous)
  }
)
