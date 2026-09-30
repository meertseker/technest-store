import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { filterStoreProductIds } from "../../../../utils/devices"
import { isTradeCustomer, listTradeTiers } from "../../../../utils/trade"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  if (!(await isTradeCustomer(req.scope, req.auth_context.actor_id))) {
    throw new MedusaError(
      MedusaError.Types.FORBIDDEN,
      "Trade pricing is only available to approved trade accounts"
    )
  }
  const [visible] = await filterStoreProductIds(
    req.scope,
    [req.params.id],
    req.publishable_key_context?.sales_channel_ids ?? []
  )
  if (!visible) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id: ${req.params.id} was not found`
    )
  }
  res.json(await listTradeTiers(req.scope, req.params.id))
}
