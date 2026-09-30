/**
 * Product attributes (docs/contracts/product-attributes.md v1). The store
 * reads them from the `product_attributes` link (`fields=+product_attributes.*`).
 * Older seeds stored the same keys in product.metadata, so that is the
 * fallback. Null or missing -> the contract defaults.
 */

export type SafetyMarking = "UKCA" | "CE" | "none"

export type ProductAttributes = {
  connector_a: string | null
  connector_b: string | null
  wattage: number | null
  cable_length_m: number | null
  platform: string[]
  is_addon_item: boolean
  safety_marking: SafetyMarking
  warranty_months: number | null
}

export const DEFAULT_ATTRIBUTES: ProductAttributes = {
  connector_a: null,
  connector_b: null,
  wattage: null,
  cable_length_m: null,
  platform: [],
  is_addon_item: false,
  safety_marking: "none",
  warranty_months: null,
}

export type WithAttributes = {
  metadata?: Record<string, unknown> | null
  product_attributes?: Record<string, unknown> | null
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null
}

export function readAttributes(p: WithAttributes): ProductAttributes {
  const linked = p.product_attributes
  const src: Record<string, unknown> =
    linked && typeof linked === "object" ? linked : (p.metadata ?? {})
  const platform = Array.isArray(src.platform)
    ? src.platform.filter((x): x is string => typeof x === "string" && !!x)
    : []
  const marking = src.safety_marking
  return {
    connector_a: str(src.connector_a),
    connector_b: str(src.connector_b),
    wattage: num(src.wattage),
    cable_length_m: num(src.cable_length_m),
    platform,
    is_addon_item: src.is_addon_item === true,
    safety_marking: marking === "UKCA" || marking === "CE" ? marking : "none",
    warranty_months: num(src.warranty_months),
  }
}

export const PLATFORM_LABELS: Record<string, string> = {
  ps5: "PS5",
  ps4: "PS4",
  "xbox-series": "Xbox Series X|S",
  "xbox-one": "Xbox One",
  switch: "Nintendo Switch",
  "switch-2": "Nintendo Switch 2",
  pc: "PC",
  mac: "Mac",
}

export const platformLabel = (p: string) => PLATFORM_LABELS[p] ?? p

/**
 * Connector values for filtering. A few seeded values name several ports
 * ("HDMI, USB-A, SD"), so they are split. "UK plug" and "12V socket" are
 * power inputs, not connectors a shopper filters by, but they are harmless.
 */
export function connectorsOf(a: ProductAttributes): string[] {
  return [a.connector_a, a.connector_b]
    .filter((c): c is string => !!c)
    .flatMap((c) => c.split(","))
    .map((c) => c.trim())
    .filter(Boolean)
}

const formatNumber = (n: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(n)

export type SpecRow = { label: string; value: string }

/** The full specs table, in a fixed order, only rows with a value */
export function specRows(a: ProductAttributes): SpecRow[] {
  const rows: SpecRow[] = []
  if (a.connector_a) rows.push({ label: "Connector", value: a.connector_a })
  if (a.connector_b) rows.push({ label: "Other end", value: a.connector_b })
  if (a.wattage !== null) rows.push({ label: "Power", value: `${formatNumber(a.wattage)}W` })
  if (a.cable_length_m !== null)
    rows.push({ label: "Cable length", value: `${formatNumber(a.cable_length_m)} m` })
  if (a.platform.length)
    rows.push({ label: "Works with", value: a.platform.map(platformLabel).join(", ") })
  if (a.safety_marking !== "none")
    rows.push({ label: "Safety marking", value: a.safety_marking })
  if (a.warranty_months !== null)
    rows.push({ label: "Warranty", value: `${a.warranty_months} months` })
  return rows
}

/**
 * One-sentence "In plain English" summary built only from facts we hold
 * (never invented): "USB-C to Lightning. 20W. 1 m long. Works with PS5.
 * UKCA marked. 12-month warranty."
 */
export function plainEnglish(a: ProductAttributes): string[] {
  const out: string[] = []
  if (a.connector_a && a.connector_b) out.push(`Connects ${a.connector_a} to ${a.connector_b}.`)
  else if (a.connector_a) out.push(`Uses ${a.connector_a}.`)
  if (a.wattage !== null) out.push(`Up to ${formatNumber(a.wattage)}W of power.`)
  if (a.cable_length_m !== null) out.push(`${formatNumber(a.cable_length_m)} m long.`)
  if (a.platform.length) out.push(`Works with ${a.platform.map(platformLabel).join(", ")}.`)
  if (a.safety_marking !== "none") out.push(`${a.safety_marking} safety marked.`)
  if (a.warranty_months !== null) out.push(`${a.warranty_months}-month warranty.`)
  return out
}
