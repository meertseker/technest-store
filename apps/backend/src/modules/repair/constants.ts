export const REPAIR_BOOKING_STATUSES = ["new", "booked", "done"] as const
export type RepairBookingStatus = (typeof REPAIR_BOOKING_STATUSES)[number]

export const REPAIR_EVENTS = {
  CREATED: "technest.repair_booking.created",
} as const

export const REPAIR_BOOKING_FIELDS = [
  "id",
  "name",
  "phone",
  "email",
  "device",
  "device_id",
  "fault",
  "preferred_time",
  "status",
  "notes",
  "created_at",
  "updated_at",
]

export type RepairBookingDTO = {
  id: string
  name: string
  phone: string
  email: string
  device: string
  device_id: string | null
  fault: string
  preferred_time: string
  status: RepairBookingStatus
  notes: string | null
  created_at: string
  updated_at: string
}

const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : new Date(value as string).toISOString()

/** Maps a stored row to the contract shape (docs/contracts/repairs.md). */
export function toRepairBookingDTO(row: Record<string, unknown>): RepairBookingDTO {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    email: row.email as string,
    device: row.device as string,
    device_id: (row.device_id as string | null) ?? null,
    fault: row.fault as string,
    preferred_time: row.preferred_time as string,
    status: row.status as RepairBookingStatus,
    notes: (row.notes as string | null) ?? null,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  }
}
