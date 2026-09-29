import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import ProductDeviceLink from "../../links/product-device"
import {
  DEVICE_FIELDS,
  DeviceDTO,
  DeviceType,
  sortDevices,
  toDeviceDTO,
} from "../../modules/device/utils"

export type LinkedDeviceDTO = DeviceDTO & { note: string | null }

export async function listDeviceDTOs(
  scope: MedusaContainer,
  filters: { id?: string[]; slug?: string; type?: DeviceType[]; brand?: string[] } = {}
): Promise<DeviceDTO[]> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "device",
    fields: [...DEVICE_FIELDS, "created_at"],
    filters,
  })
  return (data as Record<string, unknown>[]).map(toDeviceDTO)
}

export async function retrieveDeviceBySlug(
  scope: MedusaContainer,
  slug: string
): Promise<DeviceDTO> {
  const [device] = await listDeviceDTOs(scope, { slug })
  if (!device) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Device ${slug} was not found`)
  }
  return device
}

export async function retrieveDeviceById(
  scope: MedusaContainer,
  id: string
): Promise<DeviceDTO> {
  const [device] = await listDeviceDTOs(scope, { id: [id] })
  if (!device) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Device with id: ${id} was not found`
    )
  }
  return device
}

export async function listDeviceLinks(
  scope: MedusaContainer,
  filters: { product_id?: string; device_id?: string }
): Promise<{ product_id: string; device_id: string; note: string | null }[]> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: ProductDeviceLink.entryPoint,
    fields: ["product_id", "device_id", "note"],
    filters,
  })
  return data as { product_id: string; device_id: string; note: string | null }[]
}

/** The devices linked to a product, in storefront display order, with link notes. */
export async function listLinkedDevices(
  scope: MedusaContainer,
  productId: string
): Promise<LinkedDeviceDTO[]> {
  const links = await listDeviceLinks(scope, { product_id: productId })
  if (!links.length) {
    return []
  }
  const notes = new Map(links.map((l) => [l.device_id, l.note ?? null]))
  const devices = await listDeviceDTOs(scope, { id: [...notes.keys()] })
  return sortDevices(devices).map((device) => ({
    ...device,
    note: notes.get(device.id) ?? null,
  }))
}

export async function assertProductExists(
  scope: MedusaContainer,
  productId: string,
  opts: { publishedOnly?: boolean } = {}
) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "status"],
    filters: { id: productId },
  })
  const product = data[0] as { id: string; status: string } | undefined
  if (!product || (opts.publishedOnly && product.status !== "published")) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id: ${productId} was not found`
    )
  }
}
