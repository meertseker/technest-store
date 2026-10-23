import { clearVisitorCache, fetchDailyVisitors, visitorsConfigured } from "../visitors"

const ZONE = "e7c37de0f6c17284018e19ce407c4ead"
const env = { CLOUDFLARE_ANALYTICS_TOKEN: "tok", CLOUDFLARE_ZONE_ID: ZONE } as NodeJS.ProcessEnv

const reply = (body: unknown, ok = true) => jest.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body }))

const groups = [
  { dimensions: { date: "2026-10-22" }, sum: { pageViews: 40 }, uniq: { uniques: 12 } },
  { dimensions: { date: "2026-10-23" }, sum: { pageViews: 287 }, uniq: { uniques: 225 } },
]

beforeEach(() => clearVisitorCache())

describe("fetchDailyVisitors", () => {
  it("is off without a token and zone", async () => {
    expect(visitorsConfigured({} as NodeJS.ProcessEnv)).toBe(false)
    const f = reply({})
    expect(await fetchDailyVisitors("2026-10-22", "2026-10-23", { env: {} as NodeJS.ProcessEnv, fetchImpl: f })).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it("reads daily unique visitors and page views, sending the token only to Cloudflare", async () => {
    const f = reply({ data: { viewer: { zones: [{ httpRequests1dGroups: groups }] } }, errors: null })
    const rows = await fetchDailyVisitors("2026-10-22", "2026-10-23", { env, fetchImpl: f })
    expect(rows).toEqual([
      { date: "2026-10-22", visitors: 12, page_views: 40 },
      { date: "2026-10-23", visitors: 225, page_views: 287 },
    ])
    const [url, init] = (f.mock.calls[0] as unknown) as [string, { headers: Record<string, string>; body: string }]
    expect(url).toBe("https://api.cloudflare.com/client/v4/graphql")
    expect(init.headers.Authorization).toBe("Bearer tok")
    expect(init.body).toContain(ZONE)
    expect(init.body).toContain('date_geq: \\"2026-10-22\\"')
  })

  it("answers from a 10-minute cache", async () => {
    const f = reply({ data: { viewer: { zones: [{ httpRequests1dGroups: groups }] } } })
    await fetchDailyVisitors("2026-10-22", "2026-10-23", { env, fetchImpl: f, now: 1_000_000 })
    await fetchDailyVisitors("2026-10-22", "2026-10-23", { env, fetchImpl: f, now: 1_000_000 + 9 * 60_000 })
    expect(f).toHaveBeenCalledTimes(1)
    await fetchDailyVisitors("2026-10-22", "2026-10-23", { env, fetchImpl: f, now: 1_000_000 + 11 * 60_000 })
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("gives up quietly on an error, a GraphQL error, a timeout or odd input", async () => {
    expect(await fetchDailyVisitors("2026-10-22", "2026-10-23", { env, fetchImpl: reply({}, false) })).toBeNull()
    expect(await fetchDailyVisitors("2026-10-22", "2026-10-23", { env, fetchImpl: reply({ data: null, errors: [{ message: "quota" }] }) })).toBeNull()
    const hang = jest.fn((_u: string, init: { signal: AbortSignal }) => new Promise<never>((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))))
    expect(await fetchDailyVisitors("2026-10-22", "2026-10-23", { env, fetchImpl: hang as never, timeoutMs: 20 })).toBeNull()
    const f = reply({})
    expect(await fetchDailyVisitors('2026-10-22"}', "2026-10-23", { env, fetchImpl: f })).toBeNull()
    expect(await fetchDailyVisitors("2026-10-22", "2026-10-23", { env: { ...env, CLOUDFLARE_ZONE_ID: 'x" } }' }, fetchImpl: f })).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })
})
