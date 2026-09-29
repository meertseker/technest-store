import { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import {
  filterStoreProductIds,
  listDeviceLinks,
  retrieveDeviceBySlug,
} from "../../../utils/devices"

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const device = await retrieveDeviceBySlug(req.scope, req.params.slug)
  const links = await listDeviceLinks(req.scope, { device_id: device.id })
  const visible = await filterStoreProductIds(
    req.scope,
    links.map((l) => l.product_id),
    req.publishable_key_context.sales_channel_ids
  )
  res.json({ device, product_count: visible.length })
}
