import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import ProductDeviceLink from "../../links/product-device"
import { DEVICE_MODULE } from "../../modules/device"

export type DeviceLinkRow = {
  product_id: string
  device_id: string
  note: string | null
}

export type ReplaceDeviceLinksInput = {
  /** Link rows to remove (matched on product_id + device_id). */
  dismiss: { product_id: string; device_id: string }[]
  /** Link rows to create after the removals. */
  create: DeviceLinkRow[]
}

const toLinkDefinition = (row: { product_id: string; device_id: string }) => ({
  [Modules.PRODUCT]: { product_id: row.product_id },
  [DEVICE_MODULE]: { device_id: row.device_id },
})

/**
 * Removes and (re)creates product-device links in one step. The compensation
 * restores the exact rows that existed before, notes included.
 */
export const replaceDeviceLinksStep = createStep(
  "replace-device-links",
  async ({ dismiss, create }: ReplaceDeviceLinksInput, { container }) => {
    const link = container.resolve(ContainerRegistrationKeys.LINK)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const touched = [...dismiss, ...create]
    const productIds = [...new Set(touched.map((row) => row.product_id))]
    const deviceIds = [...new Set(touched.map((row) => row.device_id))]
    const { data: before } = productIds.length
      ? await query.graph({
          entity: ProductDeviceLink.entryPoint,
          fields: ["product_id", "device_id", "note"],
          filters: { product_id: productIds, device_id: deviceIds },
        })
      : { data: [] }
    const previous = (before as DeviceLinkRow[]).filter((row) =>
      touched.some(
        (t) => t.product_id === row.product_id && t.device_id === row.device_id
      )
    )

    const toDismiss = [...dismiss, ...create]
    if (toDismiss.length) {
      await link.dismiss(toDismiss.map(toLinkDefinition))
    }
    if (create.length) {
      await link.create(
        create.map((row) => ({ ...toLinkDefinition(row), data: { note: row.note } }))
      )
    }

    return new StepResponse(undefined, { previous, created: create })
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }
    const link = container.resolve(ContainerRegistrationKeys.LINK)
    if (compensation.created.length) {
      await link.dismiss(compensation.created.map(toLinkDefinition))
    }
    if (compensation.previous.length) {
      await link.create(
        compensation.previous.map((row) => ({
          ...toLinkDefinition(row),
          data: { note: row.note },
        }))
      )
    }
  }
)
