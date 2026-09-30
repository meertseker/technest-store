import { Module } from "@medusajs/framework/utils"
import RepairModuleService from "./service"

export const REPAIR_MODULE = "repair"

export default Module(REPAIR_MODULE, {
  service: RepairModuleService,
})
