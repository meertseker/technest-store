import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { runOrConflict } from "../../../../../lib/lock-busy"
import { rejectTradeApplicationWorkflow } from "../../../../../workflows/reject-trade-application"
import { retrieveTradeApplicationDTO, TRADE_BUSY_MESSAGE } from "../../../../utils/trade"
import { AdminRejectTradeApplication } from "../../middlewares"

export async function POST(
  req: MedusaRequest<AdminRejectTradeApplication>,
  res: MedusaResponse
) {
  await runOrConflict(
    () =>
      rejectTradeApplicationWorkflow(req.scope).run({
        input: { id: req.params.id, reason: req.validatedBody.reason },
      }),
    TRADE_BUSY_MESSAGE
  )
  const trade_application = await retrieveTradeApplicationDTO(req.scope, req.params.id)
  res.json({ trade_application })
}
