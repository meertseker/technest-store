import { MedusaResponse } from "@medusajs/framework/http"
import { HttpTypes } from "@medusajs/framework/types"
import { GET as listStoreProducts } from "@medusajs/medusa/api/store/products/route"
import { DeviceProductsRequest } from "../../middlewares"

/**
 * Same handler and middleware stack as GET /store/products, narrowed to the
 * device's products; adds `notes` (product id -> link note).
 */
export async function GET(req: DeviceProductsRequest, res: MedusaResponse) {
  const json = res.json.bind(res)
  // Only expose notes for products actually in this (filtered) page.
  res.json = (body: HttpTypes.StoreProductListResponse) => {
    const allNotes = req.deviceProductNotes ?? {}
    const notes = Object.fromEntries(
      body.products.filter((p) => allNotes[p.id]).map((p) => [p.id, allNotes[p.id]])
    )
    return json({ ...body, notes })
  }

  await listStoreProducts(
    req as unknown as Parameters<typeof listStoreProducts>[0],
    res as MedusaResponse<HttpTypes.StoreProductListResponse>
  )
}
