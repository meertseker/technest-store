import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rejectTradeApplicationWorkflow } from "../../../../../workflows/reject-trade-application"
import { retrieveTradeApplicationDTO } from "../../../../utils/trade"
import { AdminRejectTradeApplication } from "../../middlewares"

export async function POST(
  req: MedusaRequest<AdminRejectTradeApplication>,
  res: MedusaResponse
) {
  await rejectTradeApplicationWorkflow(req.scope).run({
    input: { id: req.params.id, reason: req.validatedBody.reason },
  })
  const trade_application = await retrieveTradeApplicationDTO(req.scope, req.params.id)
  res.json({ trade_application })
}
