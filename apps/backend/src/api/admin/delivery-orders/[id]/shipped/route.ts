import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { isLockBusyError } from "../../../../../lib/click-collect"
import { markDeliveryShippedWorkflow } from "../../../../../workflows/mark-delivery-shipped"
import type { AdminPostDeliveryOrderShipped } from "../../middlewares"

/** Packed and handed to the carrier: fulfils the order and sends the "on its way" email. */
export async function POST(req: AuthenticatedMedusaRequest<AdminPostDeliveryOrderShipped>, res: MedusaResponse) {
  try {
    const { tracking_number, tracking_url } = req.validatedBody ?? {}
    const { result } = await markDeliveryShippedWorkflow(req.scope).run({
      input: { order_id: req.params.id, actor_id: req.auth_context?.actor_id, tracking_number, tracking_url },
    })
    res.json(result)
  } catch (e) {
    if (isLockBusyError(e)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Order ${req.params.id} is being updated. Refresh in a moment.`
      )
    }
    throw e
  }
}
