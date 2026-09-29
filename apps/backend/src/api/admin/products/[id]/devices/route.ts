import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setProductDevicesWorkflow } from "../../../../../workflows/set-product-devices"
import { assertProductExists, listLinkedDevices } from "../../../../utils/devices"
import { AdminSetProductDevices } from "../../../devices/middlewares"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  await assertProductExists(req.scope, req.params.id)
  const devices = await listLinkedDevices(req.scope, req.params.id)
  res.json({ devices })
}

export async function POST(
  req: MedusaRequest<AdminSetProductDevices>,
  res: MedusaResponse
) {
  await setProductDevicesWorkflow(req.scope).run({
    input: { product_id: req.params.id, ...req.validatedBody },
  })
  const devices = await listLinkedDevices(req.scope, req.params.id)
  res.json({ devices })
}
