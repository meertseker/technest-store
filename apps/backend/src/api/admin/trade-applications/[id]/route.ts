import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { runOrConflict } from "../../../../lib/lock-busy"
import { deleteTradeApplicationWorkflow } from "../../../../workflows/delete-trade-application"
import { retrieveTradeApplicationDTO, TRADE_BUSY_MESSAGE } from "../../../utils/trade"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const trade_application = await retrieveTradeApplicationDTO(req.scope, req.params.id)
  res.json({ trade_application })
}

/**
 * Deletes an application (docs/contracts/trade.md). 404 when unknown; 400 for
 * the approved application of a customer still in the Trade group (revoke first).
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  await runOrConflict(
    () => deleteTradeApplicationWorkflow(req.scope).run({ input: { id: req.params.id } }),
    TRADE_BUSY_MESSAGE
  )
  res.json({ id: req.params.id, object: "trade_application", deleted: true })
}
