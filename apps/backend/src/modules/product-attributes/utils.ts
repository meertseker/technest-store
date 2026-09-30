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

/** Vapes are never listed online (brief, domain rules). */
const VAPE_PATTERN = /\b(vapes?|vaping|e-?cig(arette)?s?|e-?liquids?|disposable pod)\b/i

type CategoryRow = {
  handle?: string | null
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

function categoryHandles(category: CategoryRow): string[] {
  const handles: string[] = []
  let current = category
  for (let depth = 0; current && depth < 10; depth++) {
    if (current.handle) handles.push(current.handle)
    current = current.parent_category ?? null
  }
  return handles
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
    product.handle?.replace(/-/g, " "),
    ...(product.tags ?? []).map((t) => t?.value),
  ]
  if (words.some((w) => w && VAPE_PATTERN.test(w))) {
    return `"${name}" looks like a vape product. Vapes are never sold online, so it can't be published.`
  }

  const guarded = (product.categories ?? []).some((c) =>
    categoryHandles(c).some((h) => SAFETY_MARKED_CATEGORY_HANDLES.includes(h))
  )
  const marking = product.product_attributes?.safety_marking
  if (guarded && marking !== "UKCA" && marking !== "CE") {
    return `"${name}" is a charger or power product, so it needs a safety marking (UKCA or CE) before it can be published. Set "Safety marking" in the product details, then publish.`
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
  "categories.parent_category.handle",
  "categories.parent_category.parent_category.handle",
  "product_attributes.safety_marking",
]
