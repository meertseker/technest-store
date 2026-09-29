import { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  ProductStatus,
} from "@medusajs/framework/utils"
import ProductDeviceLink from "../../links/product-device"
import {
  DEVICE_FIELDS,
  DeviceDTO,
  DeviceType,
  sortDevices,
  toDeviceDTO,
} from "../../modules/device/utils"

export type LinkedDeviceDTO = DeviceDTO & { note: string | null }

type DeviceFilters = {
  id?: string[]
  slug?: string
  type?: DeviceType[]
  brand?: string[]
}

export async function listDeviceDTOs(
  scope: MedusaContainer,
  filters: DeviceFilters = {}
): Promise<DeviceDTO[]> {
  return (await listDevicesWithCreatedAt(scope, filters)).map(
    ({ created_at: _, ...device }) => device
  )
}

/** Like listDeviceDTOs, plus created_at for admin ordering. */
export async function listDevicesWithCreatedAt(
  scope: MedusaContainer,
  filters: DeviceFilters = {}
): Promise<(DeviceDTO & { created_at: Date })[]> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "device",
    fields: [...DEVICE_FIELDS, "created_at"],
    filters,
  })
  return (data as Record<string, unknown>[]).map((row) => ({
    ...toDeviceDTO(row),
    created_at: new Date(row.created_at as string),
  }))
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

export async function assertProductExists(scope: MedusaContainer, productId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { id: productId },
  })
  if (!data.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id: ${productId} was not found`
    )
  }
}

/**
 * The subset of `productIds` a storefront may show: published and in one of
 * the publishable key's sales channels (as the core store product routes do).
 */
export async function filterStoreProductIds(
  scope: MedusaContainer,
  productIds: string[],
  salesChannelIds: string[]
): Promise<string[]> {
  if (!productIds.length || !salesChannelIds.length) {
    return []
  }
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: inChannel } = await query.graph({
    entity: "product_sales_channel",
    fields: ["product_id"],
    filters: { product_id: productIds, sales_channel_id: salesChannelIds },
  })
  const ids = [...new Set(inChannel.map((row) => row.product_id as string))]
  if (!ids.length) {
    return []
  }
  const { data: published } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { id: ids, status: ProductStatus.PUBLISHED },
  })
  return published.map((p) => p.id as string)
}
