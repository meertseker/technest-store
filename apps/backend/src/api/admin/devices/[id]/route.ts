import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteDevicesWorkflow } from "../../../../workflows/delete-devices"
import { updateDeviceWorkflow } from "../../../../workflows/update-device"
import { listDeviceLinks, retrieveDeviceById } from "../../../utils/devices"
import { AdminUpdateDevice } from "../middlewares"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const device = await retrieveDeviceById(req.scope, req.params.id)
  const links = await listDeviceLinks(req.scope, { device_id: device.id })

  let products: { id: string; title: string; thumbnail: string | null; note: string | null }[] = []
  if (links.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "thumbnail"],
      filters: { id: links.map((l) => l.product_id) },
    })
    const notes = new Map(links.map((l) => [l.product_id, l.note ?? null]))
    products = data
      .map((p) => ({
        id: p.id as string,
        title: p.title as string,
        thumbnail: (p.thumbnail as string | null) ?? null,
        note: notes.get(p.id as string) ?? null,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  res.json({ device: { ...device, products } })
}

export async function POST(
  req: MedusaRequest<AdminUpdateDevice>,
  res: MedusaResponse
) {
  await retrieveDeviceById(req.scope, req.params.id)
  await updateDeviceWorkflow(req.scope).run({
    input: { id: req.params.id, ...req.validatedBody },
  })
  const device = await retrieveDeviceById(req.scope, req.params.id)
  res.json({ device })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  await deleteDevicesWorkflow(req.scope).run({ input: { ids: [req.params.id] } })
  res.json({ id: req.params.id, object: "device", deleted: true })
}
