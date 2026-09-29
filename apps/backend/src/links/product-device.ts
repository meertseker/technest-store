import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import DeviceModule from "../modules/device"

// Many-to-many: a product fits many devices, a device has many products.
// `note` holds caveats such as "Slim case only".
export default defineLink(
  { linkable: ProductModule.linkable.product, isList: true },
  { linkable: DeviceModule.linkable.device, isList: true },
  {
    database: {
      extraColumns: {
        note: { type: "text", nullable: true },
      },
    },
  }
)
