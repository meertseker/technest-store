import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import ProductDeviceLink from "../links/product-device"
import { DEVICE_EVENTS } from "../modules/device/constants"
import { deleteDevicesStep } from "./steps/delete-devices"
import { replaceDeviceLinksStep } from "./steps/replace-device-links"


export type DeleteDevicesWorkflowInput = { ids: string[] }

export const deleteDevicesWorkflow = createWorkflow(
  "delete-devices",
  function (input: DeleteDevicesWorkflowInput) {
    const { data: links } = useQueryGraphStep({
      entity: ProductDeviceLink.entryPoint,
      fields: ["product_id", "device_id"],
      filters: { device_id: input.ids },
    })
    const linkChange = transform({ links }, ({ links }) => ({
      dismiss: (links as { product_id: string; device_id: string }[]).map((l) => ({
        product_id: l.product_id,
        device_id: l.device_id,
      })),
      create: [],
    }))
    replaceDeviceLinksStep(linkChange)
    deleteDevicesStep(input.ids)
    // The products that fitted these devices are re-indexed for search.
    const event = transform({ links }, ({ links }) => ({
      eventName: DEVICE_EVENTS.PRODUCT_DEVICES_CHANGED,
      data: [
        ...new Set((links as { product_id: string }[]).map((l) => l.product_id)),
      ].map((id) => ({ id })),
    }))
    emitEventStep(event)
    return new WorkflowResponse(input.ids)
  }
)
