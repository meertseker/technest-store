import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  toTradeApplicationDTO,
  TRADE_APPLICATION_FIELDS,
  TradeApplicationDTO,
  TradeApplicationStatus,
} from "../../modules/trade/constants"

/** 409 body when another review or application for the same record is still running. */
export const TRADE_BUSY_MESSAGE =
  "This trade application is being updated by another request. Try again in a moment."

type ListOptions = {
  filters: { id?: string; customer_id?: string; status?: TradeApplicationStatus[] }
  /** Field name, "-" prefix for descending. */
  order: string
  limit: number
  offset: number
}

export function orderBy(order: string): Record<string, "ASC" | "DESC"> {
  const desc = order.startsWith("-")
  return { [desc ? order.slice(1) : order]: desc ? "DESC" : "ASC" }
}

export async function listTradeApplicationDTOs(
  scope: MedusaContainer,
  { filters, order, limit, offset }: ListOptions
): Promise<{ applications: TradeApplicationDTO[]; count: number }> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data, metadata } = await query.graph({
    entity: "trade_application",
    fields: TRADE_APPLICATION_FIELDS,
    filters,
    pagination: { skip: offset, take: limit, order: { ...orderBy(order), id: "ASC" } },
  })
  return {
    applications: (data as Record<string, unknown>[]).map(toTradeApplicationDTO),
    count: metadata?.count ?? data.length,
  }
}

export async function retrieveTradeApplicationDTO(
  scope: MedusaContainer,
  id: string
): Promise<TradeApplicationDTO> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  // throwIfKeyNotFound turns an unknown id into a 404 (MedusaError NOT_FOUND).
  const { data } = await query.graph(
    { entity: "trade_application", fields: TRADE_APPLICATION_FIELDS, filters: { id } },
    { throwIfKeyNotFound: true }
  )
  return toTradeApplicationDTO(data[0] as Record<string, unknown>)
}
