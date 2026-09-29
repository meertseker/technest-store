import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import { listDeviceLinks, retrieveDeviceBySlug } from "../../../utils/devices"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const device = await retrieveDeviceBySlug(req.scope, req.params.slug)

  const links = await listDeviceLinks(req.scope, { device_id: device.id })
  let productCount = 0
  if (links.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { metadata } = await query.graph({
      entity: "product",
      fields: ["id"],
      filters: {
        id: links.map((l) => l.product_id),
        status: ProductStatus.PUBLISHED,
      },
      pagination: { skip: 0, take: 1 },
    })
    productCount = metadata?.count ?? 0
  }

  res.json({ device, product_count: productCount })
}
