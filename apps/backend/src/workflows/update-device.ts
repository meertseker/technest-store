import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import ProductDeviceLink from "../links/product-device"
import { DEVICE_EVENTS } from "../modules/device/constants"
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
    // Products are searchable by their devices' names: re-index the ones
    // linked to this device (src/search/product.ts).
    const { data: links } = useQueryGraphStep({
      entity: ProductDeviceLink.entryPoint,
      fields: ["product_id"],
      filters: { device_id: input.id },
    })
    const event = transform({ links }, ({ links }) => ({
      eventName: DEVICE_EVENTS.PRODUCT_DEVICES_CHANGED,
      data: [
        ...new Set((links as { product_id: string }[]).map((l) => l.product_id)),
      ].map((id) => ({ id })),
    }))
    emitEventStep(event)
    return new WorkflowResponse(device)
  }
)
