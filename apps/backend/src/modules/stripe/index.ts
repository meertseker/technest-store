import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import TechNestStripeService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [TechNestStripeService],
})
