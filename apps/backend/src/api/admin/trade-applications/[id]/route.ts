import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { retrieveTradeApplicationDTO } from "../../../utils/trade"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const trade_application = await retrieveTradeApplicationDTO(req.scope, req.params.id)
  res.json({ trade_application })
}
