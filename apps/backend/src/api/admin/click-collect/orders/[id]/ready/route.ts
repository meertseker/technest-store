import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  isLockBusyError,
  loadPickupOrder,
  toClickCollectOrder,
} from "../../../../../../lib/click-collect"
import { markReadyForCollectionWorkflow } from "../../../../../../workflows/mark-ready-for-collection"

/** Marks a Click & Collect order ready for collection. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    await markReadyForCollectionWorkflow(req.scope).run({ input: { order_id: req.params.id } })
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
