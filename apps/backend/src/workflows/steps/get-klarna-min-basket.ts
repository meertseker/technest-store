import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { getTechnestSettings } from "../../modules/settings/get-settings"

/**
 * Reads the admin-set Klarna minimum (integer pence, inc. VAT) from the
 * settings module. `KLARNA_MIN_BASKET_PENCE` is only the fallback default
 * inside `getTechnestSettings`. Read-only, so no compensation.
 */
export const getKlarnaMinBasketStep = createStep(
  "get-klarna-min-basket",
  async (_: void, { container }) => {
    const settings = await getTechnestSettings(container)
    return new StepResponse(settings.klarna_min_basket_pence)
  }
)
