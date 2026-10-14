import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { runOrConflict } from "../../../../../lib/lock-busy"
import { revokeTradeApplicationWorkflow } from "../../../../../workflows/revoke-trade-application"
import { retrieveTradeApplicationDTO, TRADE_BUSY_MESSAGE } from "../../../../utils/trade"
import { AdminRevokeTradeApplication } from "../../middlewares"

/** Closes an approved trade account (docs/contracts/trade.md). */
export async function POST(
  req: MedusaRequest<AdminRevokeTradeApplication>,
  res: MedusaResponse
) {
  await runOrConflict(
    () =>
      revokeTradeApplicationWorkflow(req.scope).run({
        input: { id: req.params.id, reason: req.validatedBody?.reason ?? null },
      }),
    TRADE_BUSY_MESSAGE
  )
  const trade_application = await retrieveTradeApplicationDTO(req.scope, req.params.id)
  res.json({ trade_application })
}
