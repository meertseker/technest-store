/**
 * Variant, price and stock rules for listings and the product page. Prices
 * are Medusa's major units (GBP 9.99 is 9.99): shown as they are, never
 * divided or multiplied.
 */

export type VariantLike = {
  id: string
  title?: string | null
  sku?: string | null
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  inventory_quantity?: number | null
  options?: { option_id?: string | null; value?: string | null }[] | null
  calculated_price?: {
    calculated_amount?: number | null
    original_amount?: number | null
  } | null
}

export type OptionLike = { id: string; title?: string | null }

export type ProductLike = {
  options?: OptionLike[] | null
  variants?: VariantLike[] | null
}

/** Low stock at or below this many (spec 7.3: "Low stock", amber) */
export const LOW_STOCK = 3
/** Most a shopper can add in one go when stock isn't limiting */
export const MAX_QTY = 20

export type StockState =
  | { kind: "in"; available: number | null }
  | { kind: "low"; available: number }
  | { kind: "out" }

export function stockState(v: VariantLike | null | undefined): StockState {
  if (!v) return { kind: "out" }
  if (!v.manage_inventory || v.allow_backorder) return { kind: "in", available: null }
  const qty = Math.max(0, v.inventory_quantity ?? 0)
  if (qty === 0) return { kind: "out" }
  if (qty <= LOW_STOCK) return { kind: "low", available: qty }
  return { kind: "in", available: qty }
}

export const isPurchasable = (v: VariantLike | null | undefined) => stockState(v).kind !== "out"

/** "In stock · 12 available", "Low stock · only 2 left", "Out of stock" */
export function stockLabel(s: StockState): string {
  if (s.kind === "out") return "Out of stock"
  if (s.kind === "low") return `Low stock · only ${s.available} left`
  return s.available === null ? "In stock" : `In stock · ${s.available} available`
}

/** Largest quantity the stepper allows for a variant */
export function maxQuantity(v: VariantLike | null | undefined): number {
  const s = stockState(v)
  if (s.kind === "out") return 0
  return s.available === null ? MAX_QTY : Math.min(s.available, MAX_QTY)
}

export const variantPrice = (v: VariantLike | null | undefined): number | null => {
  const n = v?.calculated_price?.calculated_amount
  return typeof n === "number" ? n : null
}

export const variantOriginalPrice = (v: VariantLike | null | undefined): number | null => {
  const n = v?.calculated_price?.original_amount
  return typeof n === "number" ? n : null
}

export function priceRange(p: ProductLike): { min: number; max: number } | null {
  const prices = (p.variants ?? []).map(variantPrice).filter((n): n is number => n !== null)
  return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null
}

/** Sale when the price list price is below the original (both major units) */
export function isOnSale(v: VariantLike | null | undefined): boolean {
  const now = variantPrice(v)
  const was = variantOriginalPrice(v)
  return now !== null && was !== null && now < was
}

// ---------------------------------------------------------------- options

export type Selected = Record<string, string>

const valueFor = (v: VariantLike, optionId: string) =>
  v.options?.find((o) => o.option_id === optionId)?.value ?? null

/** Only options with more than one value need a choice; single-value ones are fixed */
export type OptionChoice = {
  id: string
  title: string
  values: { value: string; available: boolean; exists: boolean }[]
}

/**
 * The option groups to show as buttons. A value is `exists` when some variant
 * combines it with the other current choices, and `available` when such a
 * variant can also be bought. Values keep the order variants were created in.
 */
export function optionChoices(p: ProductLike, selected: Selected): OptionChoice[] {
  const variants = p.variants ?? []
  return (p.options ?? [])
    .map((o) => {
      const values: string[] = []
      for (const v of variants) {
        const val = valueFor(v, o.id)
        if (val && !values.includes(val)) values.push(val)
      }
      return {
        id: o.id,
        title: o.title ?? "Option",
        values: values.map((value) => {
          const matches = variants.filter(
            (v) =>
              valueFor(v, o.id) === value &&
              Object.entries(selected).every(
                ([oid, sel]) => oid === o.id || valueFor(v, oid) === sel
              )
          )
          return {
            value,
            exists: matches.length > 0,
            available: matches.some(isPurchasable),
          }
        }),
      }
    })
    .filter((o) => o.values.length > 1)
}

/** The variant matching every chosen value (single-variant products need no choice) */
export function findVariant(p: ProductLike, selected: Selected): VariantLike | null {
  const variants = p.variants ?? []
  if (variants.length === 1) return variants[0]
  const needed = (p.options ?? []).filter((o) =>
    variants.some((v) => valueFor(v, o.id) !== valueFor(variants[0], o.id))
  )
  if (needed.some((o) => !selected[o.id])) return null
  return (
    variants.find((v) => needed.every((o) => valueFor(v, o.id) === selected[o.id])) ?? null
  )
}

export const selectionOf = (p: ProductLike, v: VariantLike): Selected =>
  Object.fromEntries(
    (p.options ?? [])
      .map((o) => [o.id, valueFor(v, o.id)] as const)
      .filter((e): e is readonly [string, string] => e[1] !== null)
  )

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

/**
 * The starting choice on the product page: the variant from ?v_id= if it
 * exists; else, when a "Model" option has the shopper's device, the first
 * buyable variant for it; else the first buyable variant for products with
 * one choice to make; else nothing (the shopper picks).
 */
export function initialSelection(
  p: ProductLike,
  opts: { variantId?: string | null; deviceModel?: string | null } = {}
): Selected {
  const variants = p.variants ?? []
  const byId = opts.variantId ? variants.find((v) => v.id === opts.variantId) : null
  if (byId) return selectionOf(p, byId)
  if (opts.deviceModel) {
    const want = norm(opts.deviceModel)
    const modelOption = (p.options ?? []).find((o) => /model|device/i.test(o.title ?? ""))
    if (modelOption) {
      const forDevice = variants.filter((v) => norm(valueFor(v, modelOption.id) ?? "") === want)
      const pick = forDevice.find(isPurchasable) ?? forDevice[0]
      if (pick) return selectionOf(p, pick)
    }
  }
  if (variants.length === 1) return selectionOf(p, variants[0])
  const choices = optionChoices(p, {})
  if (choices.length === 1) {
    const first = variants.find(isPurchasable) ?? variants[0]
    return first ? selectionOf(p, first) : {}
  }
  return {}
}
