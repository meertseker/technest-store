import type { Device, DeviceTree, DeviceType } from "./types"

/**
 * Typed stand-in for GET /store/devices while E1's routes are unmerged or the
 * backend is unreachable in development. Mirrors a slice of E1's device seed.
 * Never used in production (see lib/data/devices.ts).
 */
const d = (
  brand: string,
  series: string,
  model: string,
  slug: string,
  release_year: number,
  aliases: string[] = [],
  type: DeviceType = "phone"
): Device => ({
  id: `dev_mock_${slug}`,
  brand,
  series,
  model,
  slug,
  aliases,
  type,
  release_year,
  image_url: null,
})

const apple16 = [
  d("Apple", "iPhone 16", "iPhone 16 Pro Max", "iphone-16-pro-max", 2024, ["16 pro max"]),
  d("Apple", "iPhone 16", "iPhone 16 Pro", "iphone-16-pro", 2024, ["16 pro"]),
  d("Apple", "iPhone 16", "iPhone 16 Plus", "iphone-16-plus", 2024, ["16 plus"]),
  d("Apple", "iPhone 16", "iPhone 16", "iphone-16", 2024, ["16"]),
]
const apple15 = [
  d("Apple", "iPhone 15", "iPhone 15 Pro Max", "iphone-15-pro-max", 2023, ["15 pro max", "a2849"]),
  d("Apple", "iPhone 15", "iPhone 15 Pro", "iphone-15-pro", 2023, ["15 pro", "a2848"]),
  d("Apple", "iPhone 15", "iPhone 15 Plus", "iphone-15-plus", 2023, ["15 plus"]),
  d("Apple", "iPhone 15", "iPhone 15", "iphone-15", 2023, ["15"]),
]
const s24 = [
  d("Samsung", "Galaxy S24", "Galaxy S24 Ultra", "galaxy-s24-ultra", 2024, ["s24 ultra"]),
  d("Samsung", "Galaxy S24", "Galaxy S24+", "galaxy-s24-plus", 2024, ["s24 plus"]),
  d("Samsung", "Galaxy S24", "Galaxy S24", "galaxy-s24", 2024, ["s24"]),
]
const pixel = [
  d("Google", "Pixel 9", "Pixel 9 Pro", "pixel-9-pro", 2024, ["9 pro"]),
  d("Google", "Pixel 9", "Pixel 9", "pixel-9", 2024, ["9"]),
]
const sony = [
  d("Sony", "PlayStation", "PlayStation 5", "ps5", 2020, ["ps5"], "console"),
  d("Sony", "PlayStation", "PlayStation 4", "ps4", 2013, ["ps4"], "console"),
]

export const MOCK_DEVICE_TREE: DeviceTree = {
  brands: [
    {
      brand: "Apple",
      series: [
        { series: "iPhone 16", devices: apple16 },
        { series: "iPhone 15", devices: apple15 },
      ],
    },
    { brand: "Samsung", series: [{ series: "Galaxy S24", devices: s24 }] },
    { brand: "Google", series: [{ series: "Pixel 9", devices: pixel }] },
    { brand: "Sony", series: [{ series: "PlayStation", devices: sony }] },
  ],
  count: apple16.length + apple15.length + s24.length + pixel.length + sony.length,
}
