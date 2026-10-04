import { Module } from "@medusajs/framework/utils"
import SettingsModuleService from "./service"

// Not "settings": that key is Modules.SETTINGS, Medusa's own Settings module
// (admin layouts and saved views). Registering under it replaced Medusa's
// service with ours and every /admin/layouts request failed.
export const SETTINGS_MODULE = "technestSettings"

export default Module(SETTINGS_MODULE, {
  service: SettingsModuleService,
})
