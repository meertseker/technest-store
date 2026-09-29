import { Module } from "@medusajs/framework/utils"
import DeviceModuleService from "./service"

export const DEVICE_MODULE = "device"

export default Module(DEVICE_MODULE, {
  service: DeviceModuleService,
})
