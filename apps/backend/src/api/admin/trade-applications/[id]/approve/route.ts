import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { runOrConflict } from "../../../../../lib/lock-busy"
import { approveTradeApplicationWorkflow } from "../../../../../workflows/approve-trade-application"
import { retrieveTradeApplicationDTO, TRADE_BUSY_MESSAGE } from "../../../../utils/trade"
import { AdminApproveTradeApplication } from "../../middlewares"

export async function POST(
  req: MedusaRequest<AdminApproveTradeApplication>,
  res: MedusaResponse
) {
  await runOrConflict(
    () => approveTradeApplicationWorkflow(req.scope).run({ input: { id: req.params.id } }),
    TRADE_BUSY_MESSAGE
  )
  const trade_application = await retrieveTradeApplicationDTO(req.scope, req.params.id)
  res.json({ trade_application })
}
