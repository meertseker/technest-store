import type { RepairBookingStatus } from "../../lib/types"

export const REPAIR_STATUS_LABELS: Record<RepairBookingStatus, string> = {
  new: "To call back",
  booked: "Booked in",
  done: "Done",
}

export const REPAIR_STATUS_HINTS: Record<RepairBookingStatus, string> = {
  new: "Customer is waiting for a call.",
  booked: "Called and booked in.",
  done: "Repair finished or closed.",
}

export const REPAIR_STATUS_COLORS: Record<RepairBookingStatus, "orange" | "blue" | "green"> = {
  new: "orange",
  booked: "blue",
  done: "green",
}
