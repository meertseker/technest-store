import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()
const jar: Record<string, string> = {}

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({ sdk: { client: { fetch: (...a: unknown[]) => fetchMock(...a) } } }))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar[name] ? { value: jar[name] } : undefined),
    set: vi.fn(),
  }),
}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }))

type Init = {
  cache?: string
  next?: { revalidate?: number; tags?: string[] }
  headers?: Record<string, string>
}

/** The options of the first backend call whose path contains `path` */
function initFor(path: string): Init {
  const call = fetchMock.mock.calls.find(([p]) => String(p).includes(path))
  if (!call) throw new Error(`no backend call to ${path}`)
  return (call[1] ?? {}) as Init
}

function expectNeverStored(init: Init) {
  expect(init.cache).toBe("no-store")
  expect(init.next?.revalidate).toBeUndefined()
}

function expectShortLived(init: Init) {
  expect(init.next?.revalidate).toBeGreaterThan(0)
  expect(init.next?.revalidate).toBeLessThanOrEqual(300)
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({})
  for (const k of Object.keys(jar)) delete jar[k]
  Object.assign(jar, { _medusa_jwt: "token", _medusa_cart_id: "cart_1", _medusa_cache_id: "visitor" })
})

describe("what belongs to one visitor is never kept in the shared data cache", () => {
  it("the basket", async () => {
    const { retrieveCart } = await import("./cart")
    fetchMock.mockResolvedValue({ cart: { id: "cart_1" } })
    await retrieveCart()
    expectNeverStored(initFor("/store/carts/cart_1"))
  })

  it("the signed-in customer", async () => {
    const { retrieveCustomer } = await import("./customer")
    fetchMock.mockResolvedValue({ customer: { id: "cus_1" } })
    await retrieveCustomer()
    expectNeverStored(initFor("/store/customers/me"))
  })

  it("an order and the order list", async () => {
    const { retrieveOrder } = await import("./orders")
    const { listOrdersPage, retrieveAccountOrder } = await import("./account")
    fetchMock.mockResolvedValue({ order: { id: "order_1" }, orders: [], count: 0 })
    await retrieveOrder("order_1")
    expectNeverStored(initFor("/store/orders/order_1"))
    fetchMock.mockClear()
    await retrieveAccountOrder("order_2")
    expectNeverStored(initFor("/store/orders/order_2"))
    fetchMock.mockClear()
    await listOrdersPage(1)
    expectNeverStored(initFor("/store/orders"))
  })

  it("the basket's delivery options and basket rules", async () => {
    const { getBasketView } = await import("./basket")
    fetchMock.mockImplementation(async (path: string) =>
      path.includes("/store/products") ? { products: [] } : { shipping_options: [] }
    )
    await getBasketView({ id: "cart_1", items: [{ id: "li_1", product_id: "prod_1" }] } as never)
    expectNeverStored(initFor("/store/shipping-options"))
    expectNeverStored(initFor("/basket-rules"))
  })
})

describe("shop-wide data expires", () => {
  it("payment providers are read fresh for every checkout", async () => {
    const { listCartPaymentMethods } = await import("./payment")
    fetchMock.mockResolvedValue({ payment_providers: [] })
    await listCartPaymentMethods("reg_1")
    expectNeverStored(initFor("/store/payment-providers"))
  })

  it("regions are cached for a short time, and not in process memory", async () => {
    const { getRegion } = await import("./regions")
    const region = (id: string) => ({ regions: [{ id, countries: [{ iso_2: "gb" }] }] })
    fetchMock.mockResolvedValueOnce(region("reg_old")).mockResolvedValueOnce(region("reg_new"))
    expect((await getRegion("gb"))?.id).toBe("reg_old")
    expectShortLived(initFor("/store/regions"))
    // a region changed in the admin is seen without restarting the storefront
    expect((await getRegion("gb"))?.id).toBe("reg_new")
  })

  it("home-page products are cached for a short time and always at retail prices", async () => {
    const { listProducts } = await import("./products")
    fetchMock.mockImplementation(async (path: string) =>
      path.includes("/store/regions") ? { region: { id: "reg_1" } } : { products: [], count: 0 }
    )
    await listProducts({ regionId: "reg_1" })
    const init = initFor("/store/products")
    expectShortLived(init)
    expect(Object.keys(init.headers ?? {}).map((h) => h.toLowerCase())).not.toContain("authorization")
  })

  it("categories and collections are cached for a short time", async () => {
    const { listCategories } = await import("./categories")
    const { getCollectionByHandle } = await import("./collections")
    fetchMock.mockResolvedValue({ product_categories: [], collections: [] })
    await listCategories()
    expectShortLived(initFor("/store/product-categories"))
    await getCollectionByHandle("best-sellers")
    expectShortLived(initFor("/store/collections"))
  })
})

describe("no backend read is cached without an expiry", () => {
  const SRC = join(__dirname, "..", "..")
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? files(join(dir, e.name))
        : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
          ? [join(dir, e.name)]
          : []
    )

  it("every force-cache has a revalidate time next to it", () => {
    const offenders: string[] = []
    for (const file of files(SRC)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/)
      lines.forEach((line, i) => {
        if (!line.includes('"force-cache"')) return
        const around = lines.slice(Math.max(0, i - 3), i + 4).join("\n")
        if (!/revalidate:\s*[A-Z0-9_]/.test(around)) offenders.push(`${file}:${i + 1}`)
      })
    }
    expect(offenders).toEqual([])
  })
})
