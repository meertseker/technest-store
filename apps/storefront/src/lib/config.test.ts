import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@lib/util/get-locale-header", () => ({ getLocaleHeader: async () => ({ "x-medusa-locale": null }) }))

import { FETCH_TIMEOUT_MS, sdk } from "./config"

const original = { ...FETCH_TIMEOUT_MS }
const fetchStub = vi.fn()

/** A backend that accepts the connection and then never answers */
const stalled = (_url: unknown, init?: RequestInit) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason))
  })

const ok = async () =>
  new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } })

beforeEach(() => {
  fetchStub.mockReset()
  vi.stubGlobal("fetch", fetchStub)
})

afterEach(() => {
  Object.assign(FETCH_TIMEOUT_MS, original)
  vi.unstubAllGlobals()
})

describe("backend calls give up instead of hanging", () => {
  it("has a deadline of seconds, shorter for reads than for writes", () => {
    expect(FETCH_TIMEOUT_MS.read).toBeGreaterThanOrEqual(5_000)
    expect(FETCH_TIMEOUT_MS.read).toBeLessThanOrEqual(10_000)
    // completing a cart waits for the payment provider
    expect(FETCH_TIMEOUT_MS.write).toBeGreaterThanOrEqual(25_000)
    expect(FETCH_TIMEOUT_MS.write).toBeLessThanOrEqual(60_000)
  })

  it("a read against a stalled backend fails once the read deadline passes", async () => {
    FETCH_TIMEOUT_MS.read = 30
    fetchStub.mockImplementation(stalled)
    const started = Date.now()
    await expect(sdk.client.fetch("/store/carts/cart_1", { method: "GET" })).rejects.toMatchObject({
      name: "TimeoutError",
    })
    expect(Date.now() - started).toBeLessThan(2_000)
  })

  it("a call without a method counts as a read", async () => {
    FETCH_TIMEOUT_MS.read = 30
    FETCH_TIMEOUT_MS.write = 60_000
    fetchStub.mockImplementation(stalled)
    await expect(sdk.client.fetch("/store/regions")).rejects.toMatchObject({ name: "TimeoutError" })
  })

  it("a write gets the longer deadline", async () => {
    FETCH_TIMEOUT_MS.read = 30
    FETCH_TIMEOUT_MS.write = 150
    fetchStub.mockImplementation(stalled)
    const started = Date.now()
    await expect(
      sdk.client.fetch("/store/carts/cart_1/complete", { method: "POST" })
    ).rejects.toMatchObject({ name: "TimeoutError" })
    expect(Date.now() - started).toBeGreaterThanOrEqual(140)
  })

  it("keeps a signal the caller passed", async () => {
    fetchStub.mockImplementation(ok)
    const controller = new AbortController()
    await sdk.client.fetch("/store/regions", { method: "GET", signal: controller.signal })
    const init = fetchStub.mock.calls[0][1] as RequestInit
    expect(init.signal).toBe(controller.signal)
  })

  it("a healthy call is unaffected", async () => {
    fetchStub.mockImplementation(ok)
    await expect(sdk.client.fetch("/store/regions", { method: "GET" })).resolves.toEqual({ ok: true })
    expect((fetchStub.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal)
  })
})
