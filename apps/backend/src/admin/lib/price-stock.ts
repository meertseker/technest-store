// Rows for the Price & stock tab, from Medusa's admin product list
// (fields PRICE_STOCK_FIELDS). Medusa stores amounts as-is in major units
// (5.49 = £5.49); the row carries pence. Stock is the sum of the variant's
// stocked quantities (the shop has one location).

export const PRICE_STOCK_FIELDS =
  "id,title,status,thumbnail,*variants,*variants.prices,*variants.inventory_items.inventory.location_levels"

export type ProductForRows = {
  id: string
  title: string
  status?: string | null
  thumbnail?: string | null
  variants?:
    | ({
        id: string
        title?: string | null
        sku?: string | null
        inventory_items?:
          | ({
              inventory?: { location_levels?: ({ stocked_quantity?: number | string | null } | null)[] | null } | null
            } | null)[]
          | null
        prices?:
          | ({ currency_code?: string | null; amount?: number | null; price_list_id?: string | null; rules_count?: number | null } | null)[]
          | null
      } | null)[]
    | null
}

export type VariantRow = {
  product_id: string
  variant_id: string
  product_title: string
  /** Null for the only variant called "Default" (nothing worth showing). */
  variant_title: string | null
  sku: string | null
  thumbnail: string | null
  status: "draft" | "published" | "other"
  price_pence: number | null
  stock: number | null
}

export type PriceStockResponse = { variant_id: string; price_pence: number | null; stock: number | null }

/** Null when the variant has no inventory item or no level yet. */
function stockOf(items: NonNullable<NonNullable<ProductForRows["variants"]>[number]>["inventory_items"]): number | null {
  const levels = (items ?? [])
    .flatMap((i) => i?.inventory?.location_levels ?? [])
    .filter((l): l is NonNullable<typeof l> => !!l && l.stocked_quantity != null)
  if (!levels.length) return null
  return levels.reduce((sum, l) => sum + Number(l.stocked_quantity), 0)
}

export function variantRows(products: ProductForRows[]): VariantRow[] {
  const rows: VariantRow[] = []
  for (const p of products) {
    const variants = (p.variants ?? []).filter((v): v is NonNullable<typeof v> => !!v)
    for (const v of variants) {
      const gbp = (v.prices ?? []).find(
        (pr) => !!pr && pr.currency_code === "gbp" && !pr.price_list_id && !(pr.rules_count ?? 0)
      )
      const title = v.title?.trim() || null
      rows.push({
        product_id: p.id,
        variant_id: v.id,
        product_title: p.title,
        variant_title: variants.length === 1 && (!title || title === "Default") ? null : title,
        sku: v.sku?.trim() || null,
        thumbnail: p.thumbnail ?? null,
        status: p.status === "draft" ? "draft" : p.status === "published" ? "published" : "other",
        price_pence: gbp && gbp.amount != null ? Math.round(Number(gbp.amount) * 100) : null,
        stock: stockOf(v.inventory_items),
      })
    }
  }
  return rows
}

/** Whole, non-negative stock, or null for anything else. */
export function stockInputToNumber(input: string): number | null {
  const trimmed = input.trim()
  if (!/^\d{1,6}$/.test(trimmed)) return null
  const n = Number(trimmed)
  return n > 100_000 ? null : n
}

export type PriceStockBody = { price_pence?: number; stock?: number; expected_stock?: number | null }

/**
 * The write for one row (docs/contracts/price-stock.md): only the values that
 * changed, and with a new stock number the stock the page showed, so the server
 * can refuse (409) when an order or a colleague moved it meanwhile.
 */
export function priceStockBody(
  shown: Pick<VariantRow, "price_pence" | "stock">,
  typed: { price_pence: number | null; stock: number | null }
): PriceStockBody {
  const body: PriceStockBody = {}
  if (typed.price_pence !== null && typed.price_pence !== shown.price_pence) body.price_pence = typed.price_pence
  if (typed.stock !== null && typed.stock !== shown.stock) {
    body.stock = typed.stock
    body.expected_stock = shown.stock
  }
  return body
}

/** The server's 409: the stock moved since the page loaded. Reload the row and type it again. */
export function isStaleStockError(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { status?: unknown }).status === 409
}
