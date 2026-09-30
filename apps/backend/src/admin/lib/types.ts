// Response types of the Tech Nest admin API, copied from docs/contracts/*.md.
// Keep in sync with the contracts (they are the source of truth).

// docs/contracts/click-collect.md
export type CollectStatus = "to_pick" | "ready" | "collected"

export type ClickCollectOrder = {
  id: string
  display_id: number
  status: CollectStatus
  collection_code: string | null
  customer_name: string | null
  items_summary: string
  item_count: number
  items: { title: string; variant_title: string | null; quantity: number }[]
  total_pence: number
  created_at: string
  ready_at: string | null
  collected_at: string | null
  reminder_sent_at: string | null
}

export type ClickCollectListResponse = {
  orders: ClickCollectOrder[]
  count: number
  limit: number
  offset: number
}

// docs/contracts/devices.md
export const DEVICE_TYPES = ["phone", "tablet", "console", "laptop"] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]

export type Device = {
  id: string
  brand: string
  series: string
  model: string
  slug: string
  aliases: string[]
  type: DeviceType
  release_year: number | null
  image_url: string | null
}

export type LinkedDevice = Device & { note: string | null }

export type DeviceWithProducts = Device & {
  products: { id: string; title: string; thumbnail: string | null; note: string | null }[]
}

export type DeviceListResponse = {
  devices: Device[]
  count: number
  offset: number
  limit: number
}

export type DeviceInput = {
  brand: string
  series: string
  model: string
  type: DeviceType
  slug?: string
  aliases?: string[]
  release_year?: number | null
  image_url?: string | null
}

// docs/contracts/trade.md
export type TradeApplicationStatus = "pending" | "approved" | "rejected"
export type BusinessType = "sole_trader" | "partnership" | "limited_company" | "other"

export type TradeApplication = {
  id: string
  customer_id: string
  company_name: string
  vat_number: string | null
  companies_house_number: string | null
  business_type: BusinessType
  contact: { name: string; phone: string; email: string }
  status: TradeApplicationStatus
  reason: string | null
  created_at: string
  updated_at: string
}

export type TradeApplicationListResponse = {
  trade_applications: TradeApplication[]
  count: number
  limit: number
  offset: number
}

// docs/contracts/repairs.md
export const REPAIR_STATUSES = ["new", "booked", "done"] as const
export type RepairBookingStatus = (typeof REPAIR_STATUSES)[number]

export type RepairBooking = {
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

export type RepairBookingListResponse = {
  repair_bookings: RepairBooking[]
  count: number
  limit: number
  offset: number
}
