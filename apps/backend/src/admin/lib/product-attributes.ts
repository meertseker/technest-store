// Form helpers for the "Product details for Tech Nest" widget
// (docs/contracts/product-attributes.md). Pure functions so they can be unit tested.

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

export const PLATFORM_LABELS: Record<Platform, string> = {
  ps5: "PS5",
  ps4: "PS4",
  "xbox-series": "Xbox Series X|S",
  "xbox-one": "Xbox One",
  switch: "Nintendo Switch",
  "switch-2": "Nintendo Switch 2",
  pc: "PC",
  mac: "Mac",
}

export const SAFETY_MARKING_LABELS: Record<SafetyMarking, string> = {
  UKCA: "UKCA",
  CE: "CE",
  none: "None",
}

/** Suggestions for the connector fields (free text on the server). */
export const CONNECTOR_SUGGESTIONS = [
  "USB-C",
  "USB-A",
  "Lightning",
  "Micro-USB",
  "MagSafe",
  "3.5mm",
]

export type ProductAttributes = {
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

export type PublishCheck = {
  /** The product is in Chargers & Cables, Power Banks or Gaming > Charging (or a child). */
  needs_safety_marking: boolean
  /** The publish guard's message if the product were published now, else null. */
  blocked_reason: string | null
}

export type ProductAttributesResponse = {
  product_attributes: ProductAttributes
  publish_check: PublishCheck
}

export type AttributesPayload = Partial<ProductAttributes>

/** What the drawer edits: numbers as the strings typed into the inputs. */
export type AttributesForm = {
  connector_a: string
  connector_b: string
  wattage: string
  cable_length_m: string
  platform: Platform[]
  is_addon_item: boolean
  safety_marking: SafetyMarking
  warranty_months: string
  reorder_level: string
}

export type FormErrors = Partial<Record<keyof AttributesForm, string>>

const numText = (n: number | null) => (n === null || n === undefined ? "" : String(n))

export function toForm(a: ProductAttributes): AttributesForm {
  return {
    connector_a: a.connector_a ?? "",
    connector_b: a.connector_b ?? "",
    wattage: numText(a.wattage),
    cable_length_m: numText(a.cable_length_m),
    platform: [...a.platform],
    is_addon_item: a.is_addon_item,
    safety_marking: a.safety_marking,
    warranty_months: numText(a.warranty_months),
    reorder_level: numText(a.reorder_level),
  }
}

type NumberRule = {
  label: string
  max: number
  integer: boolean
  required: boolean
}

// Same limits as the route's validator (src/api/admin/products/[id]/attributes/middlewares.ts).
const NUMBER_RULES = {
  wattage: { label: "Wattage", max: 10000, integer: false, required: false },
  cable_length_m: {
    label: "Cable length",
    max: 100,
    integer: false,
    required: false,
  },
  warranty_months: {
    label: "Warranty",
    max: 240,
    integer: true,
    required: false,
  },
  reorder_level: {
    label: "Reorder level",
    max: 100000,
    integer: true,
    required: true,
  },
} satisfies Record<string, NumberRule>

const TEXT_MAX = 60

function parseNumber(raw: string, rule: NumberRule): { value: number | null; error?: string } {
  const text = raw.trim().replace(",", ".")
  if (!text) {
    return rule.required
      ? {
          value: null,
          error: `Enter a ${rule.label.toLowerCase()} (0 or more).`,
        }
      : { value: null }
  }
  const n = Number(text)
  if (!Number.isFinite(n)) return { value: null, error: `${rule.label} must be a number.` }
  if (n < 0) return { value: null, error: `${rule.label} can't be negative.` }
  if (rule.integer && !Number.isInteger(n)) {
    return { value: null, error: `${rule.label} must be a whole number.` }
  }
  if (n > rule.max) return { value: null, error: `${rule.label} can be at most ${rule.max}.` }
  return { value: n }
}

/**
 * Checks the form and builds the partial upsert body with only the fields that
 * changed. Empty optional fields are sent as null (cleared).
 */
export function toPayload(
  form: AttributesForm,
  current: ProductAttributes
): { payload: AttributesPayload; errors: FormErrors } {
  const errors: FormErrors = {}
  const next: ProductAttributes = { ...current }

  for (const key of ["connector_a", "connector_b"] as const) {
    const text = form[key].trim()
    if (text.length > TEXT_MAX) errors[key] = `Use ${TEXT_MAX} characters or fewer.`
    next[key] = text || null
  }

  for (const key of Object.keys(NUMBER_RULES) as (keyof typeof NUMBER_RULES)[]) {
    const { value, error } = parseNumber(form[key], NUMBER_RULES[key])
    if (error) errors[key] = error
    else if (key === "reorder_level") next.reorder_level = value as number
    else next[key] = value
  }

  next.platform = PLATFORMS.filter((p) => form.platform.includes(p))
  next.is_addon_item = form.is_addon_item
  next.safety_marking = form.safety_marking

  const payload: AttributesPayload = {}
  for (const key of Object.keys(next) as (keyof ProductAttributes)[]) {
    const changed =
      key === "platform"
        ? next.platform.join(",") !== [...current.platform].sort(byPlatform).join(",")
        : next[key] !== current[key]
    if (changed) (payload as Record<string, unknown>)[key] = next[key]
  }
  return { payload, errors }
}

const byPlatform = (a: Platform, b: Platform) => PLATFORMS.indexOf(a) - PLATFORMS.indexOf(b)

/** "UKCA", "None" etc. for display. */
export const markingLabel = (m: SafetyMarking) => SAFETY_MARKING_LABELS[m] ?? m

/** "65 W", "1.5 m", "12 months"; "-" when empty. */
export function withUnit(n: number | null, unit: string, many = unit): string {
  if (n === null || n === undefined) return "-"
  return `${n} ${n === 1 ? unit : many}`
}
