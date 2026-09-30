import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { TechnestSettings } from "../modules/settings/utils"
import { setFreeDeliveryThresholdStep } from "./steps/set-free-delivery-threshold"
import { upsertTechnestSettingsStep } from "./steps/upsert-technest-settings"

export const TECHNEST_SETTINGS_UPDATED = "technest.settings.updated"

export type UpdateTechnestSettingsWorkflowInput = Partial<TechnestSettings>

/**
 * Partial update of the Tech Nest settings (docs/contracts/settings.md).
 *
 * lock -> save values -> (threshold given) update Standard delivery's
 * conditional £0 price -> emit `technest.settings.updated` { keys } -> unlock.
 * A failed shipping-price update compensates the saved values.
 */
export const updateTechnestSettingsWorkflow = createWorkflow(
  "update-technest-settings",
  function (input: UpdateTechnestSettingsWorkflowInput) {
    acquireLockStep({ key: "technest-settings", timeout: 5, ttl: 30 })

    const { keys } = upsertTechnestSettingsStep(input)

    when({ input }, ({ input }) => input.free_delivery_threshold_pence !== undefined).then(
      () => {
        const thresholdInput = transform({ input }, ({ input }) => ({
          threshold_pence: input.free_delivery_threshold_pence!,
        }))
        setFreeDeliveryThresholdStep(thresholdInput)
      }
    )

    emitEventStep({
      eventName: TECHNEST_SETTINGS_UPDATED,
      data: { keys },
    })

    releaseLockStep({ key: "technest-settings" })

    return new WorkflowResponse({ keys })
  }
)
