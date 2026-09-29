import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { UpdateDeviceData, updateDeviceStep } from "./steps/update-device"
import { validateDeviceSlugsStep } from "./steps/validate-device-slugs"

export const updateDeviceWorkflow = createWorkflow(
  "update-device",
  function (input: UpdateDeviceData) {
    when({ input }, ({ input }) => !!input.slug).then(() => {
      const slugCheck = transform({ input }, ({ input }) => ({
        slugs: [input.slug as string],
        exclude_id: input.id,
      }))
      validateDeviceSlugsStep(slugCheck)
    })
    const device = updateDeviceStep(input)
    return new WorkflowResponse(device)
  }
)
