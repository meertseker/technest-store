/** Small product fixtures shaped like GET /store/products responses (tests only) */

type V = {
  id: string
  price?: number | null
  was?: number | null
  qty?: number
  managed?: boolean
  backorder?: boolean
  options?: Record<string, string>
  sku?: string
}

export function product(p: {
  id: string
  title?: string
  handle?: string
  created_at?: string
  categories?: string[]
  options?: string[]
  variants?: V[]
  metadata?: Record<string, unknown>
  product_attributes?: Record<string, unknown> | null
}) {
  const options = (p.options ?? []).map((title) => ({ id: `opt_${title}`, title }))
  return {
    id: p.id,
    title: p.title ?? p.id,
    handle: p.handle ?? p.id,
    created_at: p.created_at ?? "2026-09-01T00:00:00Z",
    categories: (p.categories ?? []).map((id) => ({ id })),
    metadata: p.metadata ?? null,
    product_attributes: p.product_attributes,
    options,
    variants: (p.variants ?? [{ id: `${p.id}_v`, price: 5 }]).map((v) => ({
      id: v.id,
      sku: v.sku ?? null,
      manage_inventory: v.managed ?? true,
      allow_backorder: v.backorder ?? false,
      inventory_quantity: v.qty ?? 10,
      options: Object.entries(v.options ?? {}).map(([title, value]) => ({
        option_id: `opt_${title}`,
        value,
      })),
      calculated_price:
        v.price === null
          ? null
          : { calculated_amount: v.price ?? 5, original_amount: v.was ?? v.price ?? 5 },
    })),
  }
}
