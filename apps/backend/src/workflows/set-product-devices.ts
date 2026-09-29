import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { replaceDeviceLinksStep } from "./steps/replace-device-links"
import { validateProductDeviceIdsStep } from "./steps/validate-product-device-ids"

export type SetProductDevicesWorkflowInput = {
  product_id: string
  add?: { device_id: string; note?: string | null }[]
  remove?: string[]
}

/** Links (or re-notes) and unlinks devices on one product. */
export const setProductDevicesWorkflow = createWorkflow(
  "set-product-devices",
  function (input: SetProductDevicesWorkflowInput) {
    const ids = transform({ input }, ({ input }) => ({
      product_id: input.product_id,
      device_ids: [
        ...new Set((input.add ?? []).map((a) => a.device_id)),
      ],
    }))
    validateProductDeviceIdsStep(ids)

    const change = transform({ input }, ({ input }) => {
      const added = new Set((input.add ?? []).map((a) => a.device_id))
      return {
        dismiss: (input.remove ?? [])
          .filter((device_id) => !added.has(device_id))
          .map((device_id) => ({ product_id: input.product_id, device_id })),
        create: (input.add ?? []).map((a) => ({
          product_id: input.product_id,
          device_id: a.device_id,
          note: a.note ?? null,
        })),
      }
    })
    replaceDeviceLinksStep(change)
    return new WorkflowResponse(input.product_id)
  }
)
