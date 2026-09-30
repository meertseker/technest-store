import {
  PublishCheckProduct,
  SafetyMarking,
  publishBlocker,
} from "../../modules/product-attributes/utils"
import {
  ImportAttributes,
  ImportRowInput,
  ImportStatus,
  ReadRowsResult,
} from "./rows"

type CategoryChain = {
  handle?: string | null
  name?: string | null
  parent_category?: CategoryChain | null
} | null

export type ImportCategory = {
  id: string
  handle: string
  name: string
  /** The category with its parents, as the publish guard reads it. */
  chain: CategoryChain
}

/** A price in the variant's price set (price-list prices excluded). */
export type ExistingPrice = {
  id: string
  currency_code: string
  amount: number
  /** Prices with rules (region, quantity) are left alone by the import. */
  rules_count: number
}

/** A variant that already exists, found by SKU. */
export type ExistingVariant = {
  variant_id: string
  product_id: string
  product_title: string
  product_handle: string
  product_status: string
  variant_count: number
  manage_inventory: boolean
  inventory_item_id: string | null
  /** Whether that inventory item already has a level at the shop's location. */
  level_exists: boolean
  category_ids: string[]
  devices: { device_id: string; note: string | null }[]
  safety_marking: SafetyMarking
  /** Product tag values (the publish guard reads them for vapes). */
  tags: string[]
  prices: ExistingPrice[]
}

/**
 * The full price list to write for an existing variant, or null when the price
 * doesn't change. Medusa replaces a variant's whole (non price-list) price set on
 * update, so every other price is sent back unchanged. Major units, as-is.
 */
export type PriceWrite = { id?: string; currency_code: string; amount: number }[]

export type PlanContext = {
  variantsBySku: Map<string, ExistingVariant>
  /** handle -> product id, for every product in the store. */
  productIdByHandle: Map<string, string>
  categories: ImportCategory[]
  deviceIdBySlug: Map<string, string>
}

export type PlanAction = "create" | "update" | "error"

export type PlanRow = {
  line: number
  sku: string
  /** The title the product will have (or had). */
  title: string
  action: PlanAction
  /** Status after the import. */
  status: ImportStatus | null
  errors: string[]
  warnings: string[]
  input: ImportRowInput
  /** Resolved values the commit workflow writes. Only set when action isn't "error". */
  resolved?: {
    product_id: string | null
    variant_id: string | null
    handle: string
    /** Only product-level columns are written for single-variant products. */
    variant_only: boolean
    category_id: string | null
    /** Full device list after the import, or null to leave links unchanged. */
    devices: { device_id: string; note: string | null }[] | null
    previous_devices: { device_id: string; note: string | null }[]
    inventory_item_id: string | null
    level_exists: boolean
    manage_inventory: boolean
    attributes: ImportAttributes
    /** Existing variants only: the prices to write, or null to leave them. */
    prices: PriceWrite | null
  }
}

export type ImportPlan = {
  file_errors: string[]
  file_warnings: string[]
  rows: PlanRow[]
  summary: {
    rows: number
    create: number
    update: number
    error: number
    with_warnings: number
    draft: number
  }
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const PRODUCT_COLUMNS: (keyof ImportRowInput)[] = [
  "title",
  "handle",
  "description",
  "category",
  "status",
  "device_slugs",
]

function findCategory(categories: ImportCategory[], ref: string) {
  const key = ref.trim().toLowerCase()
  return (
    categories.find((c) => c.handle === key) ??
    categories.find((c) => c.name.trim().toLowerCase() === key) ??
    categories.find((c) => c.handle === slugify(ref))
  )
}

const GBP = "gbp"

function priceWrite(existing: ExistingVariant | undefined, price: number | undefined) {
  if (!existing || price === undefined) return null
  const base = existing.prices.find((p) => p.currency_code === GBP && p.rules_count === 0)
  if (base && base.amount === price) return null
  const others = existing.prices
    .filter((p) => p !== base)
    .map(({ id, currency_code, amount }) => ({ id, currency_code, amount }))
  return [...others, { ...(base ? { id: base.id } : {}), currency_code: GBP, amount: price }]
}

export const DRAFT_SAFETY_WARNING =
  "Imported as a draft: chargers and power products need a safety marking (UKCA or CE) before they can be published. Add it, then publish."

/**
 * Decides, row by row, what an import will do. Pure: the caller loads the
 * context from the database. The same plan drives the preview and the commit.
 */
export function buildImportPlan(read: ReadRowsResult, ctx: PlanContext): ImportPlan {
  const firstLineBySku = new Map<string, number>()
  const handlesInFile = new Map<string, number>()

  const rows: PlanRow[] = read.rows.map((row) => {
    const { input, line } = row
    const errors = [...row.errors]
    const warnings = [...row.warnings]
    const existing = input.sku ? ctx.variantsBySku.get(input.sku) : undefined
    const title = input.title ?? existing?.product_title ?? ""

    if (input.sku) {
      const first = firstLineBySku.get(input.sku)
      if (first !== undefined) {
        errors.push(`SKU ${input.sku} is already on line ${first}. Each SKU can appear once.`)
      } else {
        firstLineBySku.set(input.sku, line)
      }
    }

    const variantOnly = Boolean(existing && existing.variant_count > 1)
    if (variantOnly) {
      const ignored =
        PRODUCT_COLUMNS.some((k) => input[k] !== undefined) ||
        Object.keys(input.attributes).length > 0
      if (ignored) {
        warnings.push(
          "This SKU is one option of a product with several options, so only its price and stock are updated. Edit the rest in the product page."
        )
      }
    }

    if (!existing) {
      if (!input.title) errors.push("Title is empty. New products need a title.")
      if (input.price === undefined) errors.push("Price is empty. New products need a price.")
    }

    // Handle: explicit, kept, or made from the title.
    let handle = existing?.product_handle ?? ""
    if (!variantOnly) {
      if (input.handle) {
        const owner = ctx.productIdByHandle.get(input.handle)
        const fileLine = handlesInFile.get(input.handle)
        if ((owner && owner !== existing?.product_id) || fileLine !== undefined) {
          errors.push(
            `Handle "${input.handle}" is already used by another product${
              fileLine !== undefined ? ` (line ${fileLine})` : ""
            }.`
          )
        }
        handle = input.handle
      } else if (!existing && input.title) {
        const base = slugify(input.title) || slugify(input.sku)
        const free = (h: string) => !ctx.productIdByHandle.has(h) && !handlesInFile.has(h)
        handle = free(base) ? base : `${base}-${slugify(input.sku)}`
        if (!free(handle)) {
          errors.push(`Title "${input.title}" matches another product. Add a unique handle.`)
        }
      }
      if (handle && (!existing || input.handle)) handlesInFile.set(handle, line)
    }

    let category: ImportCategory | undefined
    if (input.category && !variantOnly) {
      category = findCategory(ctx.categories, input.category)
      if (!category) {
        errors.push(
          `Category "${input.category}" wasn't found. Use a category handle such as "${
            ctx.categories[0]?.handle ?? "chargers-cables"
          }".`
        )
      }
    }

    let devices: { device_id: string; note: string | null }[] | null = null
    if (input.device_slugs && !variantOnly) {
      const unknown = input.device_slugs.filter((s) => !ctx.deviceIdBySlug.has(s))
      if (unknown.length) {
        errors.push(
          `Device ${unknown.map((s) => `"${s}"`).join(", ")} wasn't found. Check the slug on the Devices page.`
        )
      } else {
        const notes = new Map((existing?.devices ?? []).map((d) => [d.device_id, d.note]))
        devices = input.device_slugs.map((slug) => {
          const device_id = ctx.deviceIdBySlug.get(slug)!
          return { device_id, note: notes.get(device_id) ?? null }
        })
      }
    }

    // The categories the product ends up in, as the publish guard reads them.
    const chains = category
      ? [category.chain]
      : ctx.categories.filter((c) => existing?.category_ids.includes(c.id)).map((c) => c.chain)
    const tags = (existing?.tags ?? []).map((value) => ({ value }))

    // Vapes are never listed online, not even as drafts: ask the publish guard
    // as if the product were published (a marking is assumed, so only the vape
    // rule can answer).
    const vape = publishBlocker({
      id: input.sku,
      title,
      handle,
      status: "published",
      categories: chains,
      tags,
      product_attributes: { safety_marking: "UKCA" },
    })
    if (vape) errors.push(`${vape} Remove this row.`)

    if (existing && input.stock !== undefined && !existing.manage_inventory) {
      warnings.push("Stock isn't tracked for this product, so the stock column was skipped.")
    }

    // Final status: asked for, else unchanged, else published for new products.
    const current = existing?.product_status === "published" ? "published" : "draft"
    let status: ImportStatus = variantOnly
      ? current
      : input.status ?? (existing ? current : "published")
    if (status === "published" && !variantOnly) {
      const check: PublishCheckProduct = {
        id: input.sku,
        title,
        handle,
        status,
        categories: chains,
        tags,
        product_attributes: {
          safety_marking: input.attributes.safety_marking ?? existing?.safety_marking ?? "none",
        },
      }
      if (publishBlocker(check)) {
        status = "draft"
        warnings.push(
          existing?.product_status === "published"
            ? `${DRAFT_SAFETY_WARNING} It was live before and is now hidden.`
            : DRAFT_SAFETY_WARNING
        )
      }
    }

    const action: PlanAction = errors.length ? "error" : existing ? "update" : "create"
    const plan: PlanRow = {
      line,
      sku: input.sku,
      title,
      action,
      status: action === "error" ? null : status,
      errors,
      warnings,
      input,
    }
    if (action !== "error") {
      plan.resolved = {
        product_id: existing?.product_id ?? null,
        variant_id: existing?.variant_id ?? null,
        handle,
        variant_only: variantOnly,
        category_id: category?.id ?? null,
        devices,
        previous_devices: existing?.devices ?? [],
        inventory_item_id: existing?.inventory_item_id ?? null,
        level_exists: existing?.level_exists ?? false,
        manage_inventory: existing?.manage_inventory ?? true,
        attributes: variantOnly ? {} : input.attributes,
        prices: priceWrite(existing, input.price),
      }
    }
    return plan
  })

  return {
    file_errors: read.file_errors,
    file_warnings: read.file_warnings,
    rows,
    summary: {
      rows: rows.length,
      create: rows.filter((r) => r.action === "create").length,
      update: rows.filter((r) => r.action === "update").length,
      error: rows.filter((r) => r.action === "error").length,
      with_warnings: rows.filter((r) => r.warnings.length).length,
      draft: rows.filter((r) => r.status === "draft").length,
    },
  }
}
