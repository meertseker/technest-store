import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type ValidateProductDeviceIdsInput = {
  product_id: string
  device_ids: string[]
}

export const validateProductDeviceIdsStep = createStep(
  "validate-product-device-ids",
  async ({ product_id, device_ids }: ValidateProductDeviceIdsInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id"],
      filters: { id: product_id },
    })
    if (!products.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Product with id: ${product_id} was not found`
      )
    }

    if (device_ids.length) {
      const { data: devices } = await query.graph({
        entity: "device",
        fields: ["id"],
        filters: { id: device_ids },
      })
      const missing = device_ids.find((id) => !devices.some((d) => d.id === id))
      if (missing) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Device with id: ${missing} was not found`
        )
      }
    }
    return new StepResponse(undefined)
  }
)
