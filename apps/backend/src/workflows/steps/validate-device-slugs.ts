import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DEVICE_MODULE } from "../../modules/device"
import DeviceModuleService from "../../modules/device/service"

export type ValidateDeviceSlugsInput = {
  slugs: string[]
  /** Device being updated; its own slug doesn't count as a clash. */
  exclude_id?: string
}

export const validateDeviceSlugsStep = createStep(
  "validate-device-slugs",
  async ({ slugs, exclude_id }: ValidateDeviceSlugsInput, { container }) => {
    const duplicates = slugs.filter((slug, i) => slugs.indexOf(slug) !== i)
    if (duplicates.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Device slug ${duplicates[0]} is used more than once`
      )
    }

    const deviceService: DeviceModuleService = container.resolve(DEVICE_MODULE)
    const existing = await deviceService.listDevices(
      { slug: slugs },
      { select: ["id", "slug"] }
    )
    const clash = existing.find((device) => device.id !== exclude_id)
    if (clash) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `A device with slug ${clash.slug} already exists`
      )
    }
    return new StepResponse(undefined)
  }
)
