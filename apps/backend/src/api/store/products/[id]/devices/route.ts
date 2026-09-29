import { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { filterStoreProductIds, listLinkedDevices } from "../../../../utils/devices"

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const [visible] = await filterStoreProductIds(
    req.scope,
    [req.params.id],
    req.publishable_key_context.sales_channel_ids
  )
  if (!visible) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id: ${req.params.id} was not found`
    )
  }
  const devices = await listLinkedDevices(req.scope, req.params.id)
  res.json({ devices })
}
