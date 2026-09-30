import type { Page } from "@playwright/test"

export const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9003"
export const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
export const BASE = `http://localhost:${process.env.E2E_PORT || 8003}`
export const storeHeaders = { "x-publishable-api-key": KEY, "content-type": "application/json" }

/** A cart with the given variants (default: the first product's first variant), attached via the cart cookie */
export async function seedCart(page: Page, variantIds?: string[]) {
  const h = storeHeaders
  const { regions } = await (await page.request.get(`${BACKEND}/store/regions`, { headers: h })).json()
  if (!variantIds?.length) {
    const { products } = await (
      await page.request.get(`${BACKEND}/store/products?limit=1&fields=id,*variants`, { headers: h })
    ).json()
    variantIds = [products[0].variants[0].id]
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
