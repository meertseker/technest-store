import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { DeviceType } from "../../modules/device/utils"
import { createDevicesWorkflow } from "../../workflows/create-devices"
import { setProductDevicesWorkflow } from "../../workflows/set-product-devices"

type DeviceSeed = {
  brand: string
  series: string
  model: string
  type: DeviceType
  release_year: number
  slug?: string
  aliases?: string[]
}

const phone = (
  brand: string,
  series: string,
  release_year: number,
  models: (string | [string, string[]])[]
): DeviceSeed[] =>
  models.map((m) => {
    const [model, aliases] = Array.isArray(m) ? m : [m, []]
    return { brand, series, model, type: "phone", release_year, aliases }
  })

/** Seed device catalogue. The shop can add more in the admin. */
export const DEVICES: DeviceSeed[] = [
  ...phone("Apple", "iPhone 17", 2025, [
    ["iPhone 17", ["17"]],
    ["iPhone Air", ["17 air"]],
    ["iPhone 17 Pro", ["17 pro"]],
    ["iPhone 17 Pro Max", ["17 pro max"]],
  ]),
  ...phone("Apple", "iPhone 16", 2024, [
    ["iPhone 16", ["16"]],
    ["iPhone 16 Plus", ["16 plus"]],
    ["iPhone 16 Pro", ["16 pro"]],
    ["iPhone 16 Pro Max", ["16 pro max"]],
  ]),
  { brand: "Apple", series: "iPhone 16", model: "iPhone 16e", type: "phone", release_year: 2025, aliases: ["16e"] },
  ...phone("Apple", "iPhone 15", 2023, [
    ["iPhone 15", ["15"]],
    ["iPhone 15 Plus", ["15 plus"]],
    ["iPhone 15 Pro", ["15 pro"]],
    ["iPhone 15 Pro Max", ["15 pro max"]],
  ]),
  ...phone("Apple", "iPhone 14", 2022, [
    ["iPhone 14", ["14"]],
    ["iPhone 14 Plus", ["14 plus"]],
    ["iPhone 14 Pro", ["14 pro"]],
    ["iPhone 14 Pro Max", ["14 pro max"]],
  ]),
  ...phone("Apple", "iPhone 13", 2021, [
    ["iPhone 13 mini", ["13 mini"]],
    ["iPhone 13", ["13"]],
    ["iPhone 13 Pro", ["13 pro"]],
    ["iPhone 13 Pro Max", ["13 pro max"]],
  ]),
  ...phone("Apple", "iPhone 12", 2020, [
    ["iPhone 12 mini", ["12 mini"]],
    ["iPhone 12", ["12"]],
    ["iPhone 12 Pro", ["12 pro"]],
    ["iPhone 12 Pro Max", ["12 pro max"]],
  ]),
  ...phone("Apple", "iPhone 11", 2019, [
    ["iPhone 11", ["11"]],
    ["iPhone 11 Pro", ["11 pro"]],
    ["iPhone 11 Pro Max", ["11 pro max"]],
  ]),
  {
    brand: "Apple",
    series: "iPhone SE",
    model: "iPhone SE (3rd generation)",
    slug: "iphone-se-3",
    type: "phone",
    release_year: 2022,
    aliases: ["se 2022", "iphone se 3", "se3"],
  },

  ...phone("Samsung", "Galaxy S25", 2025, [
    ["Galaxy S25", ["s25"]],
    ["Galaxy S25+", ["s25 plus", "s25+"]],
    ["Galaxy S25 Ultra", ["s25 ultra", "s25u"]],
    ["Galaxy S25 Edge", ["s25 edge"]],
  ]),
  ...phone("Samsung", "Galaxy S24", 2024, [
    ["Galaxy S24", ["s24"]],
    ["Galaxy S24+", ["s24 plus", "s24+"]],
    ["Galaxy S24 Ultra", ["s24 ultra", "s24u"]],
    ["Galaxy S24 FE", ["s24 fe"]],
  ]),
  ...phone("Samsung", "Galaxy S23", 2023, [
    ["Galaxy S23", ["s23"]],
    ["Galaxy S23+", ["s23 plus", "s23+"]],
    ["Galaxy S23 Ultra", ["s23 ultra", "s23u"]],
  ]),
  ...phone("Samsung", "Galaxy S22", 2022, [
    ["Galaxy S22", ["s22"]],
    ["Galaxy S22+", ["s22 plus", "s22+"]],
    ["Galaxy S22 Ultra", ["s22 ultra", "s22u"]],
  ]),
  ...phone("Samsung", "Galaxy A", 2025, [
    ["Galaxy A56", ["a56"]],
    ["Galaxy A36", ["a36"]],
    ["Galaxy A16", ["a16"]],
  ]),
  ...phone("Samsung", "Galaxy A", 2024, [
    ["Galaxy A55", ["a55"]],
    ["Galaxy A35", ["a35"]],
    ["Galaxy A25", ["a25"]],
  ]),
  ...phone("Samsung", "Galaxy A", 2023, [["Galaxy A15", ["a15"]]]),

  ...phone("Google", "Pixel 10", 2025, [
    ["Pixel 10", ["pixel10"]],
    ["Pixel 10 Pro", ["pixel 10pro"]],
  ]),
  ...phone("Google", "Pixel 9", 2024, [
    ["Pixel 9", ["pixel9"]],
    ["Pixel 9 Pro", ["pixel 9pro"]],
    ["Pixel 9 Pro XL", ["pixel 9 pro xl"]],
  ]),
  { brand: "Google", series: "Pixel 9", model: "Pixel 9a", type: "phone", release_year: 2025, aliases: ["pixel9a"] },
  ...phone("Google", "Pixel 8", 2023, [
    ["Pixel 8", ["pixel8"]],
    ["Pixel 8 Pro", ["pixel 8pro"]],
  ]),
  { brand: "Google", series: "Pixel 8", model: "Pixel 8a", type: "phone", release_year: 2024, aliases: ["pixel8a"] },
  ...phone("Google", "Pixel 7", 2022, [
    ["Pixel 7", ["pixel7"]],
    ["Pixel 7 Pro", ["pixel 7pro"]],
  ]),
  { brand: "Google", series: "Pixel 7", model: "Pixel 7a", type: "phone", release_year: 2023, aliases: ["pixel7a"] },

  { brand: "Sony", series: "PlayStation", model: "PlayStation 5 Pro", slug: "ps5-pro", type: "console", release_year: 2024, aliases: ["ps5 pro"] },
  { brand: "Sony", series: "PlayStation", model: "PlayStation 5", slug: "ps5", type: "console", release_year: 2020, aliases: ["ps5", "ps5 slim", "ps5 digital"] },
  { brand: "Sony", series: "PlayStation", model: "PlayStation 4 Pro", slug: "ps4-pro", type: "console", release_year: 2016, aliases: ["ps4 pro"] },
  { brand: "Sony", series: "PlayStation", model: "PlayStation 4", slug: "ps4", type: "console", release_year: 2013, aliases: ["ps4", "ps4 slim"] },
  { brand: "Microsoft", series: "Xbox", model: "Xbox Series X", slug: "xbox-series-x", type: "console", release_year: 2020, aliases: ["series x", "xsx"] },
  { brand: "Microsoft", series: "Xbox", model: "Xbox Series S", slug: "xbox-series-s", type: "console", release_year: 2020, aliases: ["series s", "xss"] },
  { brand: "Microsoft", series: "Xbox", model: "Xbox One", slug: "xbox-one", type: "console", release_year: 2013, aliases: ["xbox one s", "xbox one x"] },
  { brand: "Nintendo", series: "Switch", model: "Nintendo Switch 2", slug: "switch-2", type: "console", release_year: 2025, aliases: ["switch 2", "switch2"] },
  { brand: "Nintendo", series: "Switch", model: "Nintendo Switch OLED", slug: "switch-oled", type: "console", release_year: 2021, aliases: ["switch oled"] },
  { brand: "Nintendo", series: "Switch", model: "Nintendo Switch", slug: "switch", type: "console", release_year: 2017, aliases: ["switch"] },
  { brand: "Nintendo", series: "Switch", model: "Nintendo Switch Lite", slug: "switch-lite", type: "console", release_year: 2019, aliases: ["switch lite"] },
]

/** Product `platform` attribute values -> the console device slugs they fit. */
const PLATFORM_DEVICES: Record<string, string[]> = {
  ps5: ["ps5", "ps5-pro"],
  ps4: ["ps4", "ps4-pro"],
  "xbox-series": ["xbox-series-x", "xbox-series-s"],
  "xbox-one": ["xbox-one"],
  switch: ["switch", "switch-oled", "switch-lite"],
  "switch-2": ["switch-2"],
}

/**
 * Seeds the device catalogue and links sample products to devices: by the
 * product's "Model" option values, and by its `platform` attribute for consoles.
 * No-op when devices already exist.
 */
export async function seedDevices(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: existing } = await query.graph({
    entity: "device",
    fields: ["id"],
    pagination: { skip: 0, take: 1 },
  })
  if (existing.length) {
    logger.info("Devices already seeded, skipping.")
    return
  }

  logger.info(`Seeding ${DEVICES.length} devices...`)
  const { result: devices } = await createDevicesWorkflow(container).run({
    input: { devices: DEVICES },
  })
  const idByModel = new Map(devices.map((d) => [d.model, d.id]))
  const idBySlug = new Map(devices.map((d) => [d.slug, d.id]))

  const { data: products } = await query.graph({
    entity: "product",
    // Options are shared across products, so read the values each product
    // actually uses from its variants.
    fields: ["id", "metadata", "variants.options.value", "variants.options.option.title"],
  })

  let linked = 0
  for (const product of products) {
    const models = (product.variants ?? []).flatMap((variant) =>
      (variant?.options ?? [])
        .filter((o) => o?.option?.title === "Model")
        .map((o) => o?.value as string)
    )
    const platforms = ((product.metadata?.platform as string[] | undefined) ?? [])
      .flatMap((p) => PLATFORM_DEVICES[p] ?? [])

    const deviceIds = [
      ...models.map((m) => idByModel.get(m)),
      ...platforms.map((s) => idBySlug.get(s)),
    ].filter((id): id is string => Boolean(id))

    if (deviceIds.length) {
      await setProductDevicesWorkflow(container).run({
        input: {
          product_id: product.id as string,
          add: [...new Set(deviceIds)].map((device_id) => ({ device_id })),
        },
      })
      linked++
    }
  }
  logger.info(`Linked ${linked} products to devices.`)
}
