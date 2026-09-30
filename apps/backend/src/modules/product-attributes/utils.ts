export const SAFETY_MARKINGS = ["UKCA", "CE", "none"] as const
export type SafetyMarking = (typeof SAFETY_MARKINGS)[number]

export const PLATFORMS = [
  "ps5",
  "ps4",
  "xbox-series",
  "xbox-one",
  "switch",
  "switch-2",
  "pc",
  "mac",
] as const
export type Platform = (typeof PLATFORMS)[number]

export const DEFAULT_REORDER_LEVEL = 3

/** The editable attributes of a product (ADR 0001), with their defaults. */
export type ProductAttributesValues = {
  connector_a: string | null
  connector_b: string | null
  wattage: number | null
  cable_length_m: number | null
  platform: Platform[]
  is_addon_item: boolean
  safety_marking: SafetyMarking
  warranty_months: number | null
  reorder_level: number
}

export const ATTRIBUTE_DEFAULTS: ProductAttributesValues = {
  connector_a: null,
  connector_b: null,
  wattage: null,
  cable_length_m: null,
  platform: [],
  is_addon_item: false,
  safety_marking: "none",
  warranty_months: null,
  reorder_level: DEFAULT_REORDER_LEVEL,
}

export const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTE_DEFAULTS) as (keyof ProductAttributesValues)[]

/** A stored row (or none) as the full set of values, defaults filled in. */
export function withDefaults(
  row?: Partial<ProductAttributesValues> | null
): ProductAttributesValues {
  return Object.fromEntries(
    ATTRIBUTE_KEYS.map((key) => [key, row?.[key] ?? ATTRIBUTE_DEFAULTS[key]])
  ) as ProductAttributesValues
}

/**
 * Categories whose products are chargers or power products: they can't be
 * published without a UKCA or CE marking. Child categories are included.
 */
export const SAFETY_MARKED_CATEGORY_HANDLES = [
  "chargers-cables",
  "power-banks",
  "gaming-charging",
]

/**
 * Vapes are never listed online (CLAUDE.md, domain rules). The attributes
 * model has no "vape" flag, so the guard reads the product's own words:
 * title, handle, tags and category handles/names. Handles are matched with
 * hyphens as spaces, so `e-liquid-10ml` reads "e liquid 10ml".
 */
const VAPE_PATTERN = /\b(vapes?|vaping|vaper?s?|e[- ]?cig(arette)?s?|e[- ]?liquids?|disposable pods?)\b/i

export function looksLikeVape(words: (string | null | undefined)[]): boolean {
  return words.some((w) => Boolean(w) && VAPE_PATTERN.test(w!.replace(/-/g, " ")))
}

type CategoryRow = {
  handle?: string | null
  name?: string | null
  parent_category?: CategoryRow | null
} | null

export type PublishCheckProduct = {
  id: string
  title?: string | null
  handle?: string | null
  status?: string | null
  categories?: CategoryRow[] | null
  tags?: ({ value?: string | null } | null)[] | null
  product_attributes?: { safety_marking?: string | null } | null
}

/** A category and its ancestors (as far as the query loaded them). */
function categoryChain(category: CategoryRow): NonNullable<CategoryRow>[] {
  const chain: NonNullable<CategoryRow>[] = []
  let current = category
  for (let depth = 0; current && depth < 10; depth++) {
    chain.push(current)
    current = current.parent_category ?? null
  }
  return chain
}

/** True when any of the categories is, or sits under, a charger/power category. */
export function inSafetyMarkedCategory(categories: CategoryRow[] | null | undefined) {
  return (categories ?? []).some((c) =>
    categoryChain(c).some((cat) => SAFETY_MARKED_CATEGORY_HANDLES.includes(cat.handle ?? ""))
  )
}

export function hasSafetyMarking(marking: string | null | undefined) {
  return marking === "UKCA" || marking === "CE"
}

export function safetyMarkingMessage(name: string) {
  return `"${name}" is a charger or power product, so it needs a safety marking (UKCA or CE) before it can be published. Set "Safety marking" in the product details, then publish.`
}

/**
 * Why a product may not be published, or null when it may. Only published
 * products are checked; drafts can hold anything.
 */
export function publishBlocker(product: PublishCheckProduct): string | null {
  if (product.status !== "published") return null

  const name = product.title || product.handle || product.id
  const words = [
    product.title,
    product.handle,
    ...(product.tags ?? []).map((t) => t?.value),
    ...(product.categories ?? []).flatMap((c) =>
      categoryChain(c).flatMap((cat) => [cat.handle, cat.name])
    ),
  ]
  if (looksLikeVape(words)) {
    return `"${name}" looks like a vape product. Vapes are never sold online, so it can't be published.`
  }

  if (
    inSafetyMarkedCategory(product.categories) &&
    !hasSafetyMarking(product.product_attributes?.safety_marking)
  ) {
    return safetyMarkingMessage(name)
  }
  return null
}

/** Query fields `publishBlocker` needs. */
export const PUBLISH_CHECK_FIELDS = [
  "id",
  "title",
  "handle",
  "status",
  "tags.value",
  "categories.handle",
  "categories.name",
  "categories.parent_category.handle",
  "categories.parent_category.name",
  "categories.parent_category.parent_category.handle",
  "categories.parent_category.parent_category.name",
  "categories.parent_category.parent_category.parent_category.handle",
  "product_attributes.safety_marking",
]
