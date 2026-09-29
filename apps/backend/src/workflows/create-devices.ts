import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { slugifyDevice } from "../modules/device/utils"
import { CreateDeviceData, createDevicesStep } from "./steps/create-devices"
import { validateDeviceSlugsStep } from "./steps/validate-device-slugs"

export type CreateDevicesWorkflowInput = {
  devices: (Omit<CreateDeviceData, "slug"> & { slug?: string })[]
}

export const createDevicesWorkflow = createWorkflow(
  "create-devices",
  function (input: CreateDevicesWorkflowInput) {
    const data = transform({ input }, ({ input }) =>
      input.devices.map((device) => ({
        ...device,
        slug: device.slug ?? slugifyDevice(device.model),
      }))
    )
    const slugs = transform({ data }, ({ data }) => ({
      slugs: data.map((device) => device.slug),
    }))
    validateDeviceSlugsStep(slugs)
    const devices = createDevicesStep(data)
    return new WorkflowResponse(devices)
  }
)
