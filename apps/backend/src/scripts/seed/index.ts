import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductOptionsWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateProductsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  CATEGORIES,
  OPTIONS,
  PRODUCTS,
  ProductSeed,
  REGION,
  SHIPPING,
  SHOP,
} from "./data"
import { upsertProductAttributesWorkflow } from "../../workflows/upsert-product-attributes"
import { applyFreeDeliveryThresholdWorkflow } from "../../workflows/apply-free-delivery-threshold"
import { getTechnestSettings } from "../../modules/settings/get-settings"

const PRODUCT_BATCH_SIZE = 10

/** Cartesian product of a product's option axes, in declaration order. */
export function variantCombinations(
  options: ProductSeed["options"]
): Record<string, string>[] {
  let combinations: Record<string, string>[] = [{}]
  for (const [title, values] of Object.entries(options)) {
    combinations = combinations.flatMap((combination) =>
      (values ?? []).map((value) => ({ ...combination, [title]: value }))
    )
  }
  return combinations
}

function variantPrice(product: ProductSeed, combination: Record<string, string>) {
  for (const value of Object.values(combination)) {
    const override = product.priceByValue?.[value]
    if (override !== undefined) {
      return override
    }
  }
  return product.price
}

function skuFor(handle: string, combination: Record<string, string>) {
  return [handle, ...Object.values(combination)]
    .join("-")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export type SeedOptions = {
  /** Also create the sample products and their stock. Never in production. */
  demo?: boolean
  /**
   * Payment providers of the GBP region. Defaults to Medusa's "no payment"
   * provider for tests and local work; the migration script passes Stripe
   * once it is registered, so real customers never see the default.
   */
  paymentProviders?: string[]
}

/**
 * `db:migrate` runs the initial seed on every new database, production included,
 * so the sample catalogue is opt-in: SEED_DEMO_DATA=true (set in dev .env files).
 */
export function demoDataEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.SEED_DEMO_DATA === "true"
}

const STOREFRONT_KEY_TITLE = "Storefront"

/**
 * Seeds Tech Nest's store configuration and categories, plus the sample
 * products when `demo` is set (the default, for tests). Used by the initial
 * migration script and integration tests.
 *
 * Every block checks before it creates, so running it again creates nothing
 * twice: Medusa re-runs a migration script that did not finish (process
 * killed, connection lost), and that second run must complete the first.
 */
export async function seedTechNest(
  container: MedusaContainer,
  { demo = true, paymentProviders = ["pp_system_default"] }: SeedOptions = {}
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  // ---- Sales channel, publishable key, store ------------------------------
  logger.info("Seeding store data...")
  const { data: existingChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
    filters: { name: "Default Sales Channel" },
  })
  let salesChannelId = existingChannels[0]?.id
  if (!salesChannelId) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          { name: "Default Sales Channel", description: "Tech Nest online shop" },
        ],
      },
    })
    salesChannelId = result[0].id
  }

  const { data: existingKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "token", "title", "type", "revoked_at"],
    filters: { title: STOREFRONT_KEY_TITLE, type: "publishable" },
  })
  let publishableApiKey: { id: string; token: string } | undefined = existingKeys.find(
    (k) => !k.revoked_at
  )
  if (!publishableApiKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          { title: STOREFRONT_KEY_TITLE, type: "publishable", created_by: "" },
        ],
      },
    })
    publishableApiKey = result[0]
  }
  // Links are upserted, so linking again is harmless.
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: publishableApiKey.id, add: [salesChannelId] },
  })

  const storeData = {
    name: SHOP.storeName,
    supported_currencies: [
      {
        currency_code: REGION.currency_code,
        is_default: true,
        is_tax_inclusive: true,
      },
    ],
    default_sales_channel_id: salesChannelId,
  }
  const { data: existingStores } = await query.graph({
    entity: "store",
    fields: ["id"],
  })
  if (existingStores.length) {
    await updateStoresWorkflow(container).run({
      input: { selector: { id: existingStores[0].id }, update: storeData },
    })
  } else {
    await createStoresWorkflow(container).run({ input: { stores: [storeData] } })
  }

  // ---- Region and VAT ------------------------------------------------------
  logger.info("Seeding region data...")
  // A country belongs to one region only: an earlier, interrupted run's
  // region is reused as it is (its payment providers are left alone; the
  // stripe-only-region migration script owns those).
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  })
  let region: { id: string; name: string } | undefined = regions.find((r) =>
    (r.countries ?? []).some((c) => REGION.countries.includes(c?.iso_2 ?? ""))
  )
  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION.name,
            currency_code: REGION.currency_code,
            countries: REGION.countries,
            is_tax_inclusive: true,
            automatic_taxes: true,
            payment_providers: paymentProviders,
          },
        ],
      },
    })
    region = result[0]
  }

  const { data: taxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code", "parent_id"],
    filters: { country_code: REGION.countries },
  })
  const taxedCountries = new Set(
    taxRegions.filter((t) => !t.parent_id).map((t) => t.country_code)
  )
  const missingTaxCountries = REGION.countries.filter((c) => !taxedCountries.has(c))
  if (missingTaxCountries.length) {
    await createTaxRegionsWorkflow(container).run({
      input: missingTaxCountries.map((country_code) => ({
        country_code,
        provider_id: "tp_system",
        default_tax_rate: {
          name: "UK VAT",
          code: "VAT",
          rate: REGION.vat_rate,
        },
      })),
    })
  }

  // ---- Stock location, delivery and Click & Collect ------------------------
  logger.info("Seeding stock location and fulfillment data...")
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: SHOP.locationName },
  })
  let stockLocation: { id: string } | undefined = locations[0]
  if (!stockLocation) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [{ name: SHOP.locationName, address: SHOP.address }],
      },
    })
    stockLocation = result[0]
  }

  // Links are upserted, so creating one that exists changes nothing.
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })

  // `db:migrate` creates a default profile via a core migration script; test
  // databases don't run those, so create one when it's missing.
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
    filters: { type: "default" },
  })
  let shippingProfileId = shippingProfiles[0]?.id
  if (!shippingProfileId) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
    })
    shippingProfileId = result[0].id
  }

  // Fulfillment set names are unique; reuse a set an earlier run created (the
  // set and its zone are created in one call, so an existing set has its zone).
  const fulfillmentSet = async (name: string, type: string, zoneName: string) => {
    const [existing] = await fulfillmentModuleService.listFulfillmentSets(
      { name },
      { relations: ["service_zones"] }
    )
    if (existing) {
      if (!existing.service_zones?.length) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Fulfillment set "${name}" has no service zone; add one in the admin and run the seed again`
        )
      }
      return existing
    }
    return fulfillmentModuleService.createFulfillmentSets({
      name,
      type,
      service_zones: [
        { name: zoneName, geo_zones: [{ country_code: "gb", type: "country" }] },
      ],
    })
  }
  const deliverySet = await fulfillmentSet("Tech Nest delivery", "shipping", "United Kingdom")
  const pickupSet = await fulfillmentSet("Tech Nest pickup", "pickup", "Collect in store")

  for (const set of [deliverySet, pickupSet]) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
    })
  }

  const storeRules = [
    { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
    { attribute: "is_return", value: "false", operator: "eq" as const },
  ]
  const shippingOption = (
    option: (typeof SHIPPING)[keyof typeof SHIPPING],
    serviceZoneId: string
  ) => ({
    name: option.name,
    price_type: "flat" as const,
    provider_id: "manual_manual",
    service_zone_id: serviceZoneId,
    shipping_profile_id: shippingProfileId,
    type: {
      label: option.label,
      description: option.description,
      code: option.code,
    },
    prices: [
      { currency_code: REGION.currency_code, amount: option.amount },
      { region_id: region.id, amount: option.amount },
    ],
    rules: storeRules,
  })

  // One option per type code; only the ones an earlier run did not create.
  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "type.code"],
  })
  const existingCodes = new Set(existingOptions.map((o) => o.type?.code))
  const missingOptions = [
    shippingOption(SHIPPING.clickCollect, pickupSet.service_zones[0].id),
    shippingOption(SHIPPING.standard, deliverySet.service_zones[0].id),
    shippingOption(SHIPPING.nextDay, deliverySet.service_zones[0].id),
  ].filter((option) => !existingCodes.has(option.type.code))
  if (missingOptions.length) {
    await createShippingOptionsWorkflow(container).run({ input: missingOptions })
  }

  // Standard delivery is free at or above the threshold setting (contract:
  // docs/contracts/settings.md); admin saves re-apply it.
  const { free_delivery_threshold_pence } = await getTechnestSettings(container)
  await applyFreeDeliveryThresholdWorkflow(container).run({
    input: { threshold_pence: free_delivery_threshold_pence },
  })

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [salesChannelId] },
  })

  // ---- Categories ----------------------------------------------------------
  logger.info("Seeding categories...")
  // Handles are unique: only the categories an earlier run did not create.
  const categoryIdByHandle = new Map<string, string>()
  const loadCategories = async () => {
    const { data } = await query.graph({
      entity: "product_category",
      fields: ["id", "handle"],
      filters: {
        handle: CATEGORIES.flatMap((c) => [c.handle, ...(c.children ?? []).map((ch) => ch.handle)]),
      },
    })
    for (const c of data) categoryIdByHandle.set(c.handle, c.id)
  }
  await loadCategories()
  const missingTop = CATEGORIES.filter((c) => !categoryIdByHandle.has(c.handle))
  if (missingTop.length) {
    await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missingTop.map(({ name, handle }) => ({
          name,
          handle,
          is_active: true,
        })),
      },
    })
    await loadCategories()
  }
  const missingChildren = CATEGORIES.flatMap((parent) =>
    (parent.children ?? [])
      .filter((child) => !categoryIdByHandle.has(child.handle))
      .map(({ name, handle }) => ({
        name,
        handle,
        is_active: true,
        parent_category_id: categoryIdByHandle.get(parent.handle)!,
      }))
  )
  if (missingChildren.length) {
    await createProductCategoriesWorkflow(container).run({
      input: { product_categories: missingChildren },
    })
    await loadCategories()
  }

  if (!demo) {
    logger.info("Skipping sample products (SEED_DEMO_DATA is not \"true\").")
    logger.info("Finished seeding Tech Nest data.")
    return { publishableApiKey, region, stockLocation, salesChannelId }
  }

  // The sample catalogue (dev and tests only) is created in one go or not at
  // all: when any sample product exists already it is left as it is.
  const { data: sampleProducts } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { handle: PRODUCTS.map((p) => p.handle) },
  })
  if (sampleProducts.length) {
    logger.info("Sample products exist already; skipping them.")
    logger.info("Finished seeding Tech Nest data.")
    return { publishableApiKey, region, stockLocation, salesChannelId }
  }

  // ---- Shared options ------------------------------------------------------
  const { result: optionResult } = await createProductOptionsWorkflow(
    container
  ).run({
    input: {
      product_options: Object.entries(OPTIONS).map(([title, values]) => ({
        title,
        values,
      })),
    },
  })
  const optionIdByTitle = new Map(optionResult.map((o) => [o.title, o.id]))

  // ---- Products ------------------------------------------------------------
  logger.info(`Seeding ${PRODUCTS.length} products...`)
  const productInputs = PRODUCTS.map((product) => {
    const categoryId = categoryIdByHandle.get(product.category)
    if (!categoryId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Seed product ${product.handle}: unknown category ${product.category}`
      )
    }
    return {
      title: product.title,
      handle: product.handle,
      description: product.description,
      // Drafts first: the publish guard needs the attributes (safety marking)
      // in place before a charger can go live.
      status: ProductStatus.DRAFT,
      weight: product.weight,
      category_ids: [categoryId],
      shipping_profile_id: shippingProfileId,
      sales_channels: [{ id: salesChannelId }],
      options: Object.keys(product.options).map((title) => ({
        id: optionIdByTitle.get(title)!,
      })),
      variants: variantCombinations(product.options).map((combination) => ({
        title: Object.values(combination).join(" / "),
        sku: skuFor(product.handle, combination),
        options: combination,
        manage_inventory: true,
        prices: [
          {
            currency_code: REGION.currency_code,
            amount: variantPrice(product, combination),
          },
        ],
      })),
    }
  })

  const productIds: string[] = []
  for (let start = 0; start < productInputs.length; start += PRODUCT_BATCH_SIZE) {
    const { result } = await createProductsWorkflow(container).run({
      input: { products: productInputs.slice(start, start + PRODUCT_BATCH_SIZE) },
    })
    productIds.push(...result.map((p) => p.id))
  }

  logger.info("Seeding product attributes and publishing...")
  const seedByHandle = new Map(PRODUCTS.map((p) => [p.handle, p]))
  const { data: created } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { id: productIds },
  })
  for (const product of created) {
    const seed = seedByHandle.get(product.handle)!
    await upsertProductAttributesWorkflow(container).run({
      input: {
        product_id: product.id,
        ...seed.attributes,
        reorder_level: seed.reorder_level,
      },
    })
  }
  await updateProductsWorkflow(container).run({
    input: {
      selector: { id: productIds },
      update: { status: ProductStatus.PUBLISHED },
    },
  })

  // ---- Inventory -----------------------------------------------------------
  logger.info("Seeding inventory levels...")
  const stockByHandle = new Map(PRODUCTS.map((p) => [p.handle, p.stock]))
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "product.handle", "inventory_items.inventory_item_id"],
  })

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: variants.flatMap((variant) =>
        (variant.inventory_items ?? []).map((item) => ({
          location_id: stockLocation.id,
          inventory_item_id: item!.inventory_item_id,
          stocked_quantity: stockByHandle.get(variant.product?.handle ?? "") ?? 0,
        }))
      ),
    },
  })

  logger.info("Finished seeding Tech Nest data.")
  return { publishableApiKey, region, stockLocation, salesChannelId }
}
