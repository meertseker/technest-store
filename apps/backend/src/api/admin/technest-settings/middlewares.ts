import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { MAX_SETTING_PENCE } from "../../../modules/settings/utils"

const pence = z.number().int().min(0).max(MAX_SETTING_PENCE)

/** Partial update; unknown keys are rejected (400 invalid_data). */
export const AdminUpdateTechnestSettings = z
  .strictObject({
    free_delivery_threshold_pence: pence.optional(),
    klarna_min_basket_pence: pence.optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: "Provide at least one setting to update",
  })
export type AdminUpdateTechnestSettings = z.infer<typeof AdminUpdateTechnestSettings>

export const adminTechnestSettingsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/technest-settings",
    middlewares: [validateAndTransformBody(AdminUpdateTechnestSettings)],
  },
]
