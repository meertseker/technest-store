import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadPickupOrder, toClickCollectOrder } from "../../../../../../lib/click-collect"
import { markReadyForCollectionWorkflow } from "../../../../../../workflows/mark-ready-for-collection"

/** Marks a Click & Collect order ready for collection. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await markReadyForCollectionWorkflow(req.scope).run({ input: { order_id: req.params.id } })
  const order = await loadPickupOrder(req.scope, req.params.id)
  res.json({ order: toClickCollectOrder(order) })
}
