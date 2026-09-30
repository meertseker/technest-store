import { Module } from "@medusajs/framework/utils"
import PhotoModuleService from "./service"

export const PHOTO_MODULE = "photo"

export default Module(PHOTO_MODULE, {
  service: PhotoModuleService,
})

export * from "./providers/types"
