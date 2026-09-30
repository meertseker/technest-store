import { z } from "@medusajs/framework/zod"
import {
  inSafetyMarkedCategory,
  looksLikeVape,
  SAFETY_MARKINGS,
  SafetyMarking,
} from "../../modules/product-attributes/utils"

/**
 * Quick Add: the draft Claude returns for a product photo (the structured
 * output schema) and how it maps onto our catalogue. Everything here is a
 * suggestion for staff to check; nothing is written from it directly.
 */

export const PRODUCT_TYPES = [
  "case",
  "screen-protector",
  "charger",
  "cable",
  "power-bank",
  "wireless-charger",
  "car-charger",
  "adapter",
  "earphones",
  "headphones",
  "speaker",
  "controller",
  "gaming-headset",
  "gaming-accessory",
  "keyboard-mouse",
  "hub",
  "memory-card",
  "mount-holder",
  "watch-strap",
  "other",
] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

export const CONFIDENCE = ["low", "medium", "high"] as const

/**
 * The structured output schema sent to Claude (JSON Schema via the SDK's zod
 * helper). Kept to plain types and enums: limits (lengths, price range,
 * known handles/slugs) are enforced in `mapSuggestion`, not by the model.
 */
export const ClaudeProductDraft = z.object({
  is_product_photo: z
    .boolean()
    .describe("False when no sellable product is visible in the photo."),
  title: z.string().describe("Listing title, UK English, at most 80 characters."),
  description: z
    .string()
    .describe("One to three plain sentences for shoppers. Only what is visible or printed."),
  category_handle: z
    .string()
    .nullable()
    .describe("One handle from the category list, or null."),
  product_type: z.enum(PRODUCT_TYPES),
  compatible_device_slugs: z
    .array(z.string())
    .describe("Slugs from the device list only; empty when compatibility is not clear."),
  safety_marking: z
    .enum(SAFETY_MARKINGS)
    .describe('"UKCA" or "CE" only when the mark is visible; otherwise "none".'),
  safety_marking_evidence: z
    .string()
    .describe("Where the mark was seen, or why none was found."),
  connector_a: z.string().nullable(),
  connector_b: z.string().nullable(),
  wattage: z.number().nullable(),
  cable_length_m: z.number().nullable(),
  suggested_price_gbp: z
    .number()
    .nullable()
    .describe("Typical UK retail price incl. VAT in pounds, e.g. 12.99, or null."),
  looks_like_vape: z.boolean(),
  confidence: z.enum(CONFIDENCE),
  notes: z.string().describe("Short list of things staff should check. Empty string if none."),
})
export type ClaudeProductDraft = z.infer<typeof ClaudeProductDraft>

type ParentCategory = { handle?: string | null; name?: string | null; parent_category?: ParentCategory | null }
export type CatalogueCategory = {
  id: string
  handle: string
  name: string
  parent_category?: ParentCategory | null
}
export type CatalogueDevice = { id: string; slug: string; brand: string; model: string }
export type QuickAddCatalogue = { categories: CatalogueCategory[]; devices: CatalogueDevice[] }

/** What `POST /admin/quick-add/analyze` returns (docs/contracts/quick-add.md). */
export type QuickAddSuggestion = {
  is_product_photo: boolean
  title: string
  description: string
  category: { id: string; handle: string; name: string } | null
  product_type: ProductType
  devices: { id: string; slug: string; name: string }[]
  safety_marking: {
    guess: SafetyMarking
    evidence: string
    /** Always false: staff must check the label and confirm before saving. */
    confirmed: false
    required_to_publish: boolean
  }
  /** Major units (GBP 12.99 = 12.99), VAT included. A hint only. */
  suggested_price: { amount: number; currency_code: "gbp"; is_suggestion: true } | null
  attributes: {
    connector_a: string | null
    connector_b: string | null
    wattage: number | null
    cable_length_m: number | null
  }
  confidence: (typeof CONFIDENCE)[number]
  notes: string
  looks_like_vape: boolean
  warnings: string[]
}

export const TITLE_MAX = 120
export const DESCRIPTION_MAX = 2000
export const PRICE_MAX_GBP = 5000
const SHORT_TEXT_MAX = 60

const clip = (s: string | null | undefined, max: number) => (s ?? "").trim().slice(0, max)
const clipOrNull = (s: string | null | undefined, max: number) => clip(s, max) || null
const positiveOrNull = (n: number | null | undefined, max: number) =>
  typeof n === "number" && Number.isFinite(n) && n > 0 && n <= max ? n : null

/** Pence-safe rounding to 2 dp of a major-unit price. */
export const roundPrice = (n: number) => Math.round(n * 100) / 100

/**
 * Turns Claude's raw draft into a suggestion against our catalogue: unknown
 * category handles and device slugs are dropped, text is clipped, the price
 * must be a plausible positive amount, and the safety marking always needs
 * confirming.
 */
export function mapSuggestion(
  draft: ClaudeProductDraft,
  catalogue: QuickAddCatalogue
): QuickAddSuggestion {
  const warnings: string[] = []

  const category =
    catalogue.categories.find((c) => c.handle === draft.category_handle?.trim()) ?? null
  if (draft.category_handle && !category) {
    warnings.push("The suggested category doesn't exist here; pick one.")
  }

  const deviceBySlug = new Map(catalogue.devices.map((d) => [d.slug, d]))
  const seen = new Set<string>()
  const devices = draft.compatible_device_slugs
    .map((slug) => deviceBySlug.get(slug.trim()))
    .filter((d): d is CatalogueDevice => {
      if (!d || seen.has(d.id)) return false
      seen.add(d.id)
      return true
    })
    .map((d) => ({ id: d.id, slug: d.slug, name: `${d.brand} ${d.model}`.trim() }))

  const price = positiveOrNull(draft.suggested_price_gbp, PRICE_MAX_GBP)
  const title = clip(draft.title, TITLE_MAX)

  const requiredToPublish = inSafetyMarkedCategory(category ? [category] : [])
  if (requiredToPublish && draft.safety_marking === "none") {
    warnings.push(
      "Chargers and power products need a UKCA or CE mark before they can be published. Check the label."
    )
  }

  const vape = draft.looks_like_vape || looksLikeVape([title, draft.description])
  if (vape) {
    warnings.push("This looks like a vape product. Vapes are never sold online.")
  }
  if (!draft.is_product_photo) {
    warnings.push("No product was recognised in the photo. Fill in the details yourself.")
  }

  return {
    is_product_photo: draft.is_product_photo,
    title,
    description: clip(draft.description, DESCRIPTION_MAX),
    category: category ? { id: category.id, handle: category.handle, name: category.name } : null,
    product_type: draft.product_type,
    devices,
    safety_marking: {
      guess: draft.safety_marking,
      evidence: clip(draft.safety_marking_evidence, 300),
      confirmed: false,
      required_to_publish: requiredToPublish,
    },
    suggested_price: price
      ? { amount: roundPrice(price), currency_code: "gbp", is_suggestion: true }
      : null,
    attributes: {
      connector_a: clipOrNull(draft.connector_a, SHORT_TEXT_MAX),
      connector_b: clipOrNull(draft.connector_b, SHORT_TEXT_MAX),
      wattage: positiveOrNull(draft.wattage, 500),
      cable_length_m: positiveOrNull(draft.cable_length_m, 20),
    },
    confidence: draft.confidence,
    notes: clip(draft.notes, 600),
    looks_like_vape: vape,
    warnings,
  }
}

/** Limits on what we send to Claude, so a big shop doesn't blow up the prompt. */
export const MAX_PROMPT_CATEGORIES = 300
export const MAX_PROMPT_DEVICES = 600

export const SYSTEM_PROMPT = `You help the staff of Tech Nest, a phone, gaming and computer accessories shop in London, list a product from one photo. Staff check and edit everything you draft before anything is saved, and the product stays a draft until they publish it.

Look at the product and its packaging and fill in the listing fields:
- Describe only what you can see or read on the product or packaging. Do not invent specifications. When unsure, use null and say what to check in "notes".
- title: UK English, at most 80 characters: brand (if visible), what it is, the key spec. Example: "Anker 20W USB-C Wall Charger".
- description: one to three plain sentences for shoppers, no superlatives, no claims you cannot see.
- category_handle: exactly one handle from the category list below, or null if none fits.
- compatible_device_slugs: only slugs from the device list below, and only when the packaging or the product's shape makes compatibility clear.
- safety_marking: "UKCA" or "CE" only when you can actually see that mark on the product or packaging; otherwise "none". Say where you saw it (or that you did not) in safety_marking_evidence. Staff will confirm it against the label.
- connector_a / connector_b: connector names such as "USB-C", "Lightning", "USB-A", when visible. wattage in watts and cable_length_m in metres when printed.
- suggested_price_gbp: a typical UK high-street retail price in pounds including VAT (for example 12.99), or null if you have no basis. It is only a hint for staff.
- looks_like_vape: true for vapes, e-cigarettes, e-liquids or pods.
- is_product_photo: false when no sellable product is visible; still fill the other fields with your best effort or empty values.`

/** The shop's categories and devices as prompt text (stable order, so it caches). */
export function catalogueText(catalogue: QuickAddCatalogue): string {
  const categories = [...catalogue.categories]
    .sort((a, b) => a.handle.localeCompare(b.handle))
    .slice(0, MAX_PROMPT_CATEGORIES)
    .map((c) => {
      const parent = c.parent_category?.name ? ` (in ${c.parent_category.name})` : ""
      return `- ${c.handle}: ${c.name}${parent}`
    })
  const devices = [...catalogue.devices]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .slice(0, MAX_PROMPT_DEVICES)
    .map((d) => `- ${d.slug}: ${d.brand} ${d.model}`)
  return [
    "Categories (handle: name):",
    ...(categories.length ? categories : ["(none)"]),
    "",
    "Devices (slug: name):",
    ...(devices.length ? devices : ["(none)"]),
  ].join("\n")
}
