import type { BusinessType, TradeApplicationStatus } from "../../lib/types"

export const TRADE_STATUS_LABELS: Record<TradeApplicationStatus, string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Rejected",
  revoked: "Trade account closed",
}

export const TRADE_STATUS_COLORS: Record<TradeApplicationStatus, "orange" | "green" | "red" | "grey"> = {
  pending: "orange",
  approved: "green",
  rejected: "red",
  revoked: "grey",
}

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  sole_trader: "Sole trader",
  partnership: "Partnership",
  limited_company: "Limited company",
  other: "Other",
}
