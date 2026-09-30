import type { MedusaContainer } from "@medusajs/framework/types"
import { SETTINGS_MODULE } from "."
import type SettingsModuleService from "./service"
import { resolveSettings, SETTING_KEYS, TechnestSettings } from "./utils"

export type { TechnestSettings, TechnestSettingKey } from "./utils"

type Resolver = Pick<MedusaContainer, "resolve">

/**
 * Current Tech Nest settings in integer pence, every key present (defaults for
 * keys the owner never saved). Use this in backend code instead of reading
 * `KLARNA_MIN_BASKET_PENCE` from the environment.
 */
export async function getTechnestSettings(
  container: Resolver
): Promise<TechnestSettings> {
  const service = container.resolve<SettingsModuleService>(SETTINGS_MODULE)
  const rows = await service.listTechnestSettings(
    { key: [...SETTING_KEYS] },
    { select: ["key", "value"], take: null }
  )
  return resolveSettings(rows)
}
