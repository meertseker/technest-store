import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import ProductDeviceLink from "../links/product-device"
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
    return new WorkflowResponse(input.ids)
  }
)
