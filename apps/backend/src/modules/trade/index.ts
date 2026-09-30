import { Module } from "@medusajs/framework/utils"
import TradeModuleService from "./service"

export const TRADE_MODULE = "trade"

export default Module(TRADE_MODULE, {
  service: TradeModuleService,
})
