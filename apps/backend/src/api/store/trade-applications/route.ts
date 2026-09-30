import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { submitTradeApplicationWorkflow } from "../../../workflows/submit-trade-application"
import { retrieveTradeApplicationDTO } from "../../utils/trade"
import { StoreSubmitTradeApplication } from "./middlewares"

export async function POST(
  req: AuthenticatedMedusaRequest<StoreSubmitTradeApplication>,
  res: MedusaResponse
) {
  const { contact, ...rest } = req.validatedBody
  const { result } = await submitTradeApplicationWorkflow(req.scope).run({
    input: {
      ...rest,
      customer_id: req.auth_context.actor_id,
      contact_name: contact.name,
      contact_phone: contact.phone,
      contact_email: contact.email,
    },
  })
  const trade_application = await retrieveTradeApplicationDTO(req.scope, result.id)
  res.json({ trade_application })
}
