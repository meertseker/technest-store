import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { analyzeProductPhoto, AnalyzeFailureCode } from "../../lib/quick-add/claude"
import {
  ImageTooLargeError,
  ImageUnreadableError,
  MAX_ANALYZE_BYTES,
  prepareImageForClaude,
} from "../../lib/quick-add/image"
import {
  mapSuggestion,
  ProductType,
  QuickAddCatalogue,
  QuickAddSuggestion,
} from "../../lib/quick-add/suggestion"
import {
  hasSafetyMarking,
  looksLikeVape,
  SafetyMarking,
} from "../../modules/product-attributes/utils"

type Query = { graph: (config: Record<string, unknown>) => Promise<{ data: any[] }> }
type Resolver = { resolve: (key: string) => any }

/** Reads a File Module file, refusing anything that doesn't exist. */
async function readFile(container: Resolver, fileId: string) {
  const fileModule = container.resolve(Modules.FILE)
  try {
    const file = await fileModule.retrieveFile(fileId)
    const buffer: Buffer = await fileModule.getAsBuffer(fileId)
    return { id: file.id as string, url: file.url as string, buffer }
  } catch {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown file_id: ${fileId}`)
  }
}

/** Categories (with parents, for the publish-guard hint) and devices. Read-only. */
export const loadQuickAddCatalogueStep = createStep(
  "load-quick-add-catalogue",
  async (_: void, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as unknown as Query
    const [{ data: categories }, { data: devices }] = await Promise.all([
      query.graph({
        entity: "product_category",
        fields: [
          "id",
          "handle",
          "name",
          "parent_category.handle",
          "parent_category.name",
          "parent_category.parent_category.handle",
          "parent_category.parent_category.name",
        ],
      }),
      query.graph({ entity: "device", fields: ["id", "slug", "brand", "model"] }),
    ])
    return new StepResponse<QuickAddCatalogue>({ categories, devices })
  }
)

export type SuggestProductInput = { file_id: string; catalogue: QuickAddCatalogue }
export type SuggestProductOutput =
  | { ok: true; suggestion: QuickAddSuggestion; model: string; original: { id: string; url: string } }
  | { ok: false; code: AnalyzeFailureCode; message: string }

/**
 * Photo -> Claude -> draft suggestion. Read-only (nothing is stored), so no
 * compensation. AI failures come back as a result, not an exception, so the
 * route can answer with the right status and the UI can fall back to manual entry.
 */
export const suggestProductFromPhotoStep = createStep(
  "suggest-product-from-photo",
  async ({ file_id, catalogue }: SuggestProductInput, { container }) => {
    const file = await readFile(container, file_id)
    if (file.buffer.length > MAX_ANALYZE_BYTES) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Photo is larger than 25 MB")
    }
    let image: Awaited<ReturnType<typeof prepareImageForClaude>>
    try {
      image = await prepareImageForClaude(file.buffer)
    } catch (e) {
      if (e instanceof ImageTooLargeError || e instanceof ImageUnreadableError) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, e.message)
      }
      throw e
    }

    const result = await analyzeProductPhoto({ image, catalogue })
    if (!result.ok) {
      return new StepResponse<SuggestProductOutput>(result)
    }
    return new StepResponse<SuggestProductOutput>({
      ok: true,
      suggestion: mapSuggestion(result.draft, catalogue),
      model: result.model,
      original: { id: file.id, url: file.url },
    })
  }
)

export type QuickAddProductInput = {
  title: string
  description?: string
  category_id?: string
  product_type?: ProductType
  device_ids?: string[]
  /** Major units, VAT included (GBP 12.99 = 12.99). */
  price: number
  sku?: string
  stock?: number
  safety_marking: SafetyMarking
  safety_marking_confirmed?: boolean
  attributes?: {
    connector_a?: string | null
    connector_b?: string | null
    wattage?: number | null
    cable_length_m?: number | null
    is_addon_item?: boolean
  }
  photo_file_id?: string
  ai_assisted?: boolean
}

export type ValidatedQuickAdd = {
  handle: string
  original: { id: string; url: string } | null
}

export function toHandle(title: string) {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "product"
  )
}

/**
 * Business rules before anything is written: no vapes, a claimed safety
 * marking must be confirmed by staff, and every referenced record must exist.
 * Also picks a free handle. Read-only, so no compensation.
 */
export const validateQuickAddInputStep = createStep(
  "validate-quick-add-input",
  async (input: QuickAddProductInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as unknown as Query

    if (looksLikeVape([input.title, input.description])) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "This looks like a vape product. Vapes are never sold online, so it can't be added."
      )
    }
    if (hasSafetyMarking(input.safety_marking) && input.safety_marking_confirmed !== true) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Check the ${input.safety_marking} mark on the product or its box, then tick "I have checked the label".`
      )
    }

    const deviceIds = [...new Set(input.device_ids ?? [])]
    const [categories, devices, variants] = await Promise.all([
      input.category_id
        ? query.graph({ entity: "product_category", fields: ["id"], filters: { id: input.category_id } })
        : Promise.resolve(null),
      deviceIds.length
        ? query.graph({ entity: "device", fields: ["id"], filters: { id: deviceIds } })
        : Promise.resolve({ data: [] }),
      input.sku
        ? query.graph({ entity: "product_variant", fields: ["id"], filters: { sku: input.sku } })
        : Promise.resolve({ data: [] }),
    ])
    if (categories && !categories.data.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown category: ${input.category_id}`)
    }
    const missingDevice = deviceIds.find((id) => !devices.data.some((d) => d.id === id))
    if (missingDevice) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown device: ${missingDevice}`)
    }
    if (variants.data.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `SKU ${input.sku} is already used by another product.`
      )
    }

    const original = input.photo_file_id ? await readFile(container, input.photo_file_id) : null

    const base = toHandle(input.title)
    const { data: taken } = await query.graph({
      entity: "product",
      fields: ["handle"],
      filters: { handle: { $like: `${base}%` } },
      withDeleted: true,
    })
    const used = new Set(taken.map((p) => p.handle))
    let handle = base
    for (let n = 2; used.has(handle); n++) handle = `${base}-${n}`

    return new StepResponse<ValidatedQuickAdd>({
      handle,
      original: original ? { id: original.id, url: original.url } : null,
    })
  }
)

/**
 * The product type by value: reuses an existing one, or creates it.
 * Compensation deletes only a type this step created.
 */
export const ensureQuickAddProductTypeStep = createStep(
  "ensure-quick-add-product-type",
  async (value: string | null, { container }) => {
    if (!value) return new StepResponse<string | null, string | null>(null, null)
    const productModule = container.resolve(Modules.PRODUCT)
    const [existing] = await productModule.listProductTypes({ value }, { take: 1 })
    if (existing) return new StepResponse<string | null, string | null>(existing.id, null)
    const created = await productModule.createProductTypes({ value })
    return new StepResponse<string | null, string | null>(created.id, created.id)
  },
  async (createdId, { container }) => {
    if (!createdId) return
    await container.resolve(Modules.PRODUCT).deleteProductTypes([createdId])
  }
)
