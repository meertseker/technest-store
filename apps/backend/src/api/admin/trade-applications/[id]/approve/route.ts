import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { approveTradeApplicationWorkflow } from "../../../../../workflows/approve-trade-application"
import { retrieveTradeApplicationDTO } from "../../../../utils/trade"
import { AdminApproveTradeApplication } from "../../middlewares"

export async function POST(
  req: MedusaRequest<AdminApproveTradeApplication>,
  res: MedusaResponse
) {
  await approveTradeApplicationWorkflow(req.scope).run({
    input: { id: req.params.id },
  })
  const trade_application = await retrieveTradeApplicationDTO(req.scope, req.params.id)
  res.json({ trade_application })
}
