import {
  deviceMatchesQuery,
  groupDevices,
  slugifyDevice,
  sortDevices,
} from "../utils"

const d = (over: Partial<Parameters<typeof groupDevices>[0][number]>) => ({
  id: "dev_x",
  brand: "Apple",
  series: "iPhone 16",
  model: "iPhone 16",
  slug: "iphone-16",
  aliases: [] as string[],
  type: "phone" as const,
  release_year: 2024,
  image_url: null,
  ...over,
})

describe("slugifyDevice", () => {
  it("lowercases and kebab-cases the model", () => {
    expect(slugifyDevice("Galaxy S24 Ultra")).toBe("galaxy-s24-ultra")
    expect(slugifyDevice("  iPhone 16 Pro Max ")).toBe("iphone-16-pro-max")
    expect(slugifyDevice("Xbox Series X|S")).toBe("xbox-series-x-s")
    expect(slugifyDevice("Switch 2 (OLED)")).toBe("switch-2-oled")
    expect(slugifyDevice("Galaxy S25+")).toBe("galaxy-s25-plus")
  })
})

describe("deviceMatchesQuery", () => {
  const iphone = d({ model: "iPhone 16 Pro", slug: "iphone-16-pro", aliases: ["16 pro", "A3101"] })

  it("matches model, slug and aliases ignoring case, spaces and punctuation", () => {
    expect(deviceMatchesQuery(iphone, "iphone 16")).toBe(true)
    expect(deviceMatchesQuery(iphone, "IPHONE16PRO")).toBe(true)
    expect(deviceMatchesQuery(iphone, "a3101")).toBe(true)
    expect(deviceMatchesQuery(iphone, "16 pro")).toBe(true)
    expect(deviceMatchesQuery(iphone, "galaxy")).toBe(false)
  })

  it("matches everything for an empty query", () => {
    expect(deviceMatchesQuery(iphone, "  ")).toBe(true)
  })
})

describe("sortDevices / groupDevices", () => {
  const devices = [
    d({ id: "1", brand: "Nokia", series: "Nokia", model: "Nokia G42", slug: "nokia-g42", release_year: 2023 }),
    d({ id: "2", brand: "Samsung", series: "Galaxy S", model: "Galaxy S23", slug: "galaxy-s23", release_year: 2023 }),
    d({ id: "3", brand: "Apple", series: "iPhone 15", model: "iPhone 15", slug: "iphone-15", release_year: 2023 }),
    d({ id: "4", brand: "Apple", series: "iPhone 16", model: "iPhone 16 Pro", slug: "iphone-16-pro", release_year: 2024 }),
    d({ id: "5", brand: "Apple", series: "iPhone 16", model: "iPhone 16", slug: "iphone-16", release_year: 2024 }),
    d({ id: "6", brand: "Samsung", series: "Galaxy S", model: "Galaxy S24", slug: "galaxy-s24", release_year: 2024 }),
    d({ id: "7", brand: "Sony", series: "PlayStation", model: "PS5", slug: "ps5", type: "console", release_year: 2020 }),
    d({ id: "8", brand: "Alcatel", series: "Alcatel", model: "Alcatel 1", slug: "alcatel-1", release_year: 2019 }),
  ]

  it("orders brands Apple, Samsung, Google, Sony, Microsoft, Nintendo, then A-Z", () => {
    const groups = groupDevices(devices)
    expect(groups.map((g) => g.brand)).toEqual(["Apple", "Samsung", "Sony", "Alcatel", "Nokia"])
  })

  it("orders series newest first, devices newest first then model A-Z", () => {
    const [apple, samsung] = groupDevices(devices)
    expect(apple.series.map((s) => s.series)).toEqual(["iPhone 16", "iPhone 15"])
    expect(apple.series[0].devices.map((x) => x.model)).toEqual(["iPhone 16", "iPhone 16 Pro"])
    expect(samsung.series[0].devices.map((x) => x.model)).toEqual(["Galaxy S24", "Galaxy S23"])
  })

  it("orders series by launch year, not by a late addition", () => {
    const groups = groupDevices([
      d({ id: "a", series: "iPhone 16", model: "iPhone 16", release_year: 2024 }),
      d({ id: "b", series: "iPhone 16", model: "iPhone 16e", slug: "iphone-16e", release_year: 2025 }),
      d({ id: "c", series: "iPhone 17", model: "iPhone 17", slug: "iphone-17", release_year: 2025 }),
    ])
    expect(groups[0].series.map((s) => s.series)).toEqual(["iPhone 17", "iPhone 16"])
  })

  it("sortDevices flattens in the same order as the groups", () => {
    expect(sortDevices(devices).map((x) => x.id)).toEqual(["5", "4", "3", "6", "2", "7", "8", "1"])
  })
})
