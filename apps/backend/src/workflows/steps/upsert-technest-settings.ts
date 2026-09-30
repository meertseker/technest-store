import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { SETTINGS_MODULE } from "../../modules/settings"
import type SettingsModuleService from "../../modules/settings/service"
import {
  isSettingKey,
  isValidPence,
  MAX_SETTING_PENCE,
  TechnestSettings,
} from "../../modules/settings/utils"

export type UpsertTechnestSettingsStepInput = Partial<TechnestSettings>

type Compensation = {
  updated: { id: string; value: number }[]
  created: string[]
}

/**
 * Saves the given settings (partial). The route validates the body too; this
 * step re-checks so every caller of the workflow gets the same rules.
 * Compensation restores the previous values and removes rows it created.
 */
export const upsertTechnestSettingsStep = createStep(
  "upsert-technest-settings",
  async (input: UpsertTechnestSettingsStepInput, { container }) => {
    const entries = Object.entries(input).filter(([, v]) => v !== undefined)
    if (!entries.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Provide at least one setting to update"
      )
    }
    for (const [key, value] of entries) {
      if (!isSettingKey(key)) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown setting: ${key}`)
      }
      if (!isValidPence(value)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `${key} must be an integer between 0 and ${MAX_SETTING_PENCE}`
        )
      }
    }

    const service = container.resolve<SettingsModuleService>(SETTINGS_MODULE)
    const existing = await service.listTechnestSettings(
      { key: entries.map(([key]) => key) },
      { take: null }
    )
    const byKey = new Map(existing.map((row) => [row.key, row]))

    const toUpdate = entries
      .filter(([key]) => byKey.has(key))
      .map(([key, value]) => ({ id: byKey.get(key)!.id, value: value as number }))
    const toCreate = entries
      .filter(([key]) => !byKey.has(key))
      .map(([key, value]) => ({ key, value: value as number }))

    const compensation: Compensation = {
      updated: toUpdate.map(({ id }) => {
        const row = existing.find((r) => r.id === id)!
        return { id, value: row.value }
      }),
      created: [],
    }
    if (toUpdate.length) {
      await service.updateTechnestSettings(toUpdate)
    }
    if (toCreate.length) {
      const created = await service.createTechnestSettings(toCreate)
      compensation.created = created.map((row) => row.id)
    }

    return new StepResponse(
      { keys: entries.map(([key]) => key) },
      compensation
    )
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }
    const service = container.resolve<SettingsModuleService>(SETTINGS_MODULE)
    if (compensation.created.length) {
      await service.deleteTechnestSettings(compensation.created)
    }
    if (compensation.updated.length) {
      await service.updateTechnestSettings(compensation.updated)
    }
  }
)
