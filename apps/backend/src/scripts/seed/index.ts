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
}

/**
 * `db:migrate` runs the initial seed on every new database, production included,
 * so the sample catalogue is opt-in: SEED_DEMO_DATA=true (set in dev .env files).
 */
export function demoDataEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.SEED_DEMO_DATA === "true"
}

/**
 * Seeds Tech Nest's store configuration and categories into an empty database,
 * plus the sample products when `demo` is set (the default, for tests).
 * Used by the initial migration script and integration tests.
 */
export async function seedTechNest(
  container: MedusaContainer,
  { demo = true }: SeedOptions = {}
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

  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        { title: "Storefront", type: "publishable", created_by: "" },
      ],
    },
  })
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
  const {
    result: [region],
  } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: REGION.name,
          currency_code: REGION.currency_code,
          countries: REGION.countries,
          is_tax_inclusive: true,
          automatic_taxes: true,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  })

  await createTaxRegionsWorkflow(container).run({
    input: REGION.countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
      default_tax_rate: {
        name: "UK VAT",
        code: "VAT",
        rate: REGION.vat_rate,
      },
    })),
  })

  // ---- Stock location, delivery and Click & Collect ------------------------
  logger.info("Seeding stock location and fulfillment data...")
  const {
    result: [stockLocation],
  } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [{ name: SHOP.locationName, address: SHOP.address }],
    },
  })

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

  const deliverySet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Tech Nest delivery",
    type: "shipping",
    service_zones: [
      {
        name: "United Kingdom",
        geo_zones: [{ country_code: "gb", type: "country" }],
      },
    ],
  })
  const pickupSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Tech Nest pickup",
    type: "pickup",
    service_zones: [
      {
        name: "Collect in store",
        geo_zones: [{ country_code: "gb", type: "country" }],
      },
    ],
  })

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

  await createShippingOptionsWorkflow(container).run({
    input: [
      shippingOption(SHIPPING.clickCollect, pickupSet.service_zones[0].id),
      shippingOption(SHIPPING.standard, deliverySet.service_zones[0].id),
      shippingOption(SHIPPING.nextDay, deliverySet.service_zones[0].id),
    ],
  })

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
  const { result: topCategories } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: CATEGORIES.map(({ name, handle }) => ({
        name,
        handle,
        is_active: true,
      })),
    },
  })
  const { result: childCategories } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: CATEGORIES.flatMap((parent) =>
        (parent.children ?? []).map(({ name, handle }) => ({
          name,
          handle,
          is_active: true,
          parent_category_id: topCategories.find((c) => c.handle === parent.handle)!
            .id,
        }))
      ),
    },
  })
  const categoryIdByHandle = new Map(
    [...topCategories, ...childCategories].map((c) => [c.handle, c.id])
  )

  if (!demo) {
    logger.info("Skipping sample products (SEED_DEMO_DATA is not \"true\").")
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
