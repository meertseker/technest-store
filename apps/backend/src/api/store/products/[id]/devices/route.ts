import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { assertProductExists, listLinkedDevices } from "../../../../utils/devices"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  await assertProductExists(req.scope, req.params.id, { publishedOnly: true })
  const devices = await listLinkedDevices(req.scope, req.params.id)
  res.json({ devices })
}
