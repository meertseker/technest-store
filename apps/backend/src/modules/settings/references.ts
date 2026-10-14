import { MedusaError } from "@medusajs/framework/utils"
import { SETTINGS_MODULE } from "."
import type SettingsModuleService from "./service"

/** Keys of the `technest_reference` rows (each holds one Medusa record id). */
export const REFERENCE_KEYS = {
  TRADE_CUSTOMER_GROUP_ID: "trade_customer_group_id",
  TRADE_PRICE_LIST_ID: "trade_price_list_id",
} as const
export type ReferenceKey = (typeof REFERENCE_KEYS)[keyof typeof REFERENCE_KEYS]

type Resolver = { resolve: <T = unknown>(key: string) => T }

const service = (container: Resolver) =>
  container.resolve<SettingsModuleService>(SETTINGS_MODULE)

/** The stored id under `key`, or null when none was stored. */
export async function getReference(container: Resolver, key: ReferenceKey): Promise<string | null> {
  const [row] = await service(container).listTechnestReferences(
    { key },
    { select: ["id", "value"], take: 1 }
  )
  return row?.value ?? null
}

/**
 * Stores `value` under `key` (null removes the row). Returns the value that
 * was stored before, so a workflow step can put it back on compensation.
 */
export async function setReference(
  container: Resolver,
  key: ReferenceKey,
  value: string | null
): Promise<string | null> {
  const settings = service(container)
  const [row] = await settings.listTechnestReferences({ key }, { select: ["id", "value"], take: 1 })
  const previous = row?.value ?? null
  if (value === null) {
    if (row) {
      await settings.deleteTechnestReferences(row.id)
    }
    return previous
  }
  if (row) {
    if (row.value !== value) {
      await settings.updateTechnestReferences({ id: row.id, value })
    }
    return previous
  }
  try {
    await settings.createTechnestReferences({ key, value })
  } catch (e) {
    // Two callers stored the key at once: the unique index kept one row, keep that one.
    if (!(e instanceof MedusaError && e.type === MedusaError.Types.DUPLICATE_ERROR)) {
      throw e
    }
  }
  return previous
}
