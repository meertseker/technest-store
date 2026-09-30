import type { Page } from "@playwright/test"

export const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9003"
export const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
export const BASE = `http://localhost:${process.env.E2E_PORT || 8003}`
export const storeHeaders = { "x-publishable-api-key": KEY, "content-type": "application/json" }

type StockVariant = { id: string; inventory_quantity?: number | null; manage_inventory?: boolean | null }

/** In stock (shared dev databases run low as other suites buy things) */
export const inStock = (v: StockVariant) => v.manage_inventory === false || (v.inventory_quantity ?? 0) > 0

/** A cart with the given variants (default: the first in-stock variant), attached via the cart cookie */
export async function seedCart(page: Page, variantIds?: string[]) {
  const h = storeHeaders
  const { regions } = await (await page.request.get(`${BACKEND}/store/regions`, { headers: h })).json()
  if (!variantIds?.length) {
    const { products } = await (
      await page.request.get(
        `${BACKEND}/store/products?limit=20&fields=id,*variants,+variants.inventory_quantity`,
        { headers: h }
      )
    ).json()
    const variant = (products as { variants: StockVariant[] }[]).flatMap((p) => p.variants).find(inStock)
    variantIds = [variant!.id]
  }
  const { cart } = await (
    await page.request.post(`${BACKEND}/store/carts`, { headers: h, data: { region_id: regions[0].id } })
  ).json()
  for (const variant_id of variantIds) {
    await page.request.post(`${BACKEND}/store/carts/${cart.id}/line-items`, {
      headers: h,
      data: { variant_id, quantity: 1 },
    })
  }
  await page.context().addCookies([{ name: "_medusa_cart_id", value: cart.id, url: BASE }])
  return cart.id as string
}
