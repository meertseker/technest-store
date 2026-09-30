import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  REPAIR_BOOKING_FIELDS,
  RepairBookingDTO,
  RepairBookingStatus,
  toRepairBookingDTO,
} from "../../modules/repair/constants"
import { orderBy } from "./trade"

type ListOptions = {
  filters: { id?: string; status?: RepairBookingStatus[] }
  order: string
  limit: number
  offset: number
}

export async function listRepairBookingDTOs(
  scope: MedusaContainer,
  { filters, order, limit, offset }: ListOptions
): Promise<{ bookings: RepairBookingDTO[]; count: number }> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data, metadata } = await query.graph({
    entity: "repair_booking",
    fields: REPAIR_BOOKING_FIELDS,
    filters,
    pagination: { skip: offset, take: limit, order: { ...orderBy(order), id: "ASC" } },
  })
  return {
    bookings: (data as Record<string, unknown>[]).map(toRepairBookingDTO),
    count: metadata?.count ?? data.length,
  }
}

export async function retrieveRepairBookingDTO(
  scope: MedusaContainer,
  id: string
): Promise<RepairBookingDTO> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  // throwIfKeyNotFound turns an unknown id into a 404 (MedusaError NOT_FOUND).
  const { data } = await query.graph(
    { entity: "repair_booking", fields: REPAIR_BOOKING_FIELDS, filters: { id } },
    { throwIfKeyNotFound: true }
  )
  return toRepairBookingDTO(data[0] as Record<string, unknown>)
}
