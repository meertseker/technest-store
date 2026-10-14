import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { isLockBusyError, loadPickupOrder, toClickCollectOrder } from "../../../../../../lib/click-collect"
import { resendReadyForCollectionWorkflow } from "../../../../../../workflows/resend-ready-for-collection"

/** Sends the "ready for collection" email again. 400 unless the order is ready; 409 while it is being updated. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    await resendReadyForCollectionWorkflow(req.scope).run({ input: { order_id: req.params.id } })
  } catch (e) {
    if (isLockBusyError(e)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Order ${req.params.id} is being updated. Refresh the board in a moment.`
      )
    }
    throw e
  }
  const order = await loadPickupOrder(req.scope, req.params.id)
  res.json({ order: toClickCollectOrder(order) })
}
