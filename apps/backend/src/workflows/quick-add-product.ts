import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  batchInventoryItemLevelsWorkflow,
  createProductsWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { ImportDefaults, loadDefaults } from "./steps/build-product-import-plan"
import {
  ensureQuickAddProductTypeStep,
  QuickAddProductInput,
  validateQuickAddInputStep,
} from "./steps/quick-add-steps"
import { replaceDeviceLinksStep } from "./steps/replace-device-links"
import { upsertImportAttributesStep } from "./steps/upsert-import-attributes"

const GBP = "gbp"
const DEFAULT_OPTION = "Default option"
const DEFAULT_OPTION_VALUE = "Default option value"

/** The shop's stock location, default sales channel and shipping profile. Read-only. */
const loadQuickAddDefaultsStep = createStep("load-quick-add-defaults", async (_: void, { container }) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  return new StepResponse<ImportDefaults>(await loadDefaults(query as any))
})

/**
 * Quick Add, step 2: creates the product staff confirmed, always as a DRAFT:
 * product + variant + price (major units), attributes, device links and stock
 * at the shop's location. The photo is only recorded as the original
 * (metadata.quick_add); the photo pipeline (process -> approve) makes the
 * product image. Publishing is a separate action through the normal product
 * update, where the publish guard runs. Any failure rolls everything back.
 */
export const quickAddProductWorkflow = createWorkflow(
  "quick-add-product",
  function (input: QuickAddProductInput) {
    const validated = validateQuickAddInputStep(input)
    const defaults = loadQuickAddDefaultsStep()
    const typeValue = transform({ input }, ({ input }) => input.product_type ?? null)
    const typeId = ensureQuickAddProductTypeStep(typeValue)

    const createInput = transform(
      { input, validated, defaults, typeId },
      ({ input, validated, defaults, typeId }) => ({
        products: [
          {
            title: input.title,
            handle: validated.handle,
            description: input.description || undefined,
            // Never published from here, whatever the client sends.
            status: ProductStatus.DRAFT,
            type_id: typeId ?? undefined,
            category_ids: input.category_id ? [input.category_id] : [],
            shipping_profile_id: defaults.shipping_profile_id,
            sales_channels: [{ id: defaults.sales_channel_id }],
            metadata: {
              quick_add: {
                ai_assisted: Boolean(input.ai_assisted),
                original_file_id: validated.original?.id ?? null,
                original_url: validated.original?.url ?? null,
              },
            },
            options: [{ title: DEFAULT_OPTION, values: [DEFAULT_OPTION_VALUE] }],
            variants: [
              {
                title: "Default",
                sku: input.sku || undefined,
                options: { [DEFAULT_OPTION]: DEFAULT_OPTION_VALUE },
                manage_inventory: true,
                // Medusa prices are major units: 12.99 is stored as 12.99.
                prices: [{ currency_code: GBP, amount: input.price }],
              },
            ],
          },
        ],
      })
    )
    const created = createProductsWorkflow.runAsStep({ input: createInput })
    const productId = transform({ created }, ({ created }) => created[0].id)

    const attributes = transform({ input, productId }, ({ input, productId }) => {
      const a = input.attributes ?? {}
      const values = {
        safety_marking: input.safety_marking,
        ...(a.connector_a !== undefined ? { connector_a: a.connector_a || null } : {}),
        ...(a.connector_b !== undefined ? { connector_b: a.connector_b || null } : {}),
        ...(a.wattage !== undefined ? { wattage: a.wattage } : {}),
        ...(a.cable_length_m !== undefined ? { cable_length_m: a.cable_length_m } : {}),
        ...(a.is_addon_item !== undefined ? { is_addon_item: a.is_addon_item } : {}),
      }
      return [{ product_id: productId, values }]
    })
    upsertImportAttributesStep(attributes)

    const deviceLinks = transform({ input, productId }, ({ input, productId }) => ({
      dismiss: [],
      create: [...new Set(input.device_ids ?? [])].map((device_id) => ({
        product_id: productId,
        device_id,
        note: null,
      })),
    }))
    replaceDeviceLinksStep(deviceLinks)

    const { data: variants } = useQueryGraphStep({
      entity: "product_variant",
      fields: ["id", "inventory_items.inventory_item_id"],
      filters: { product_id: productId },
    }).config({ name: "load-quick-add-inventory-item" })

    const levels = transform({ variants, defaults, input }, ({ variants, defaults, input }) => {
      const item = (variants as any[])[0]?.inventory_items?.[0]?.inventory_item_id
      return {
        create: item
          ? [
              {
                inventory_item_id: item as string,
                location_id: defaults.location_id,
                stocked_quantity: input.stock ?? 1,
              },
            ]
          : [],
        update: [],
        delete: [] as string[],
      }
    })
    batchInventoryItemLevelsWorkflow.runAsStep({ input: levels })

    const { data: products } = useQueryGraphStep({
      entity: "product",
      fields: [
        "id",
        "title",
        "handle",
        "status",
        "description",
        "metadata",
        "type.value",
        "categories.id",
        "categories.handle",
        "variants.id",
        "variants.sku",
        "variants.prices.amount",
        "variants.prices.currency_code",
        "product_attributes.*",
      ],
      filters: { id: productId },
    }).config({ name: "load-quick-add-product" })

    const product = transform({ products }, ({ products }) => products[0])
    return new WorkflowResponse(product)
  }
)
