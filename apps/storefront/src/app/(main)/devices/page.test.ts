import type { ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MOCK_DEVICE_TREE } from "@/lib/devices/mock"
import DevicesPage from "./page"

const current = vi.hoisted(() => ({ device: null as null | { slug: string; model: string } }))

vi.mock("@lib/data/devices", () => ({
  listDevices: async () => MOCK_DEVICE_TREE,
  getCurrentDevice: async () => current.device,
}))


const render = async (sp: Record<string, string>) =>
  renderToStaticMarkup(
    (await DevicesPage({ searchParams: Promise.resolve(sp) })) as ReactElement
  )
const count = (html: string, needle: string) => html.split(needle).length - 1

describe("/devices?q=", () => {
  beforeEach(() => {
    current.device = null
  })

  // The list lives only inside <DeviceSearch> (data-testid="device-results"), which
  // swaps it for live results when the shopper types; the page adds no second list.
  it("renders exactly one results list (no duplicate server list)", async () => {
    const html = await render({ q: "15 pro" })
    expect(count(html, 'data-testid="device-results"')).toBe(1)
    expect(count(html, 'value="iphone-15-pro"')).toBe(1)
    expect(count(html, "match “15 pro”")).toBe(1)
  })

  it("shows one no-match message for an unknown device", async () => {
    const html = await render({ q: "nokia 3310" })
    expect(count(html, 'data-testid="device-results"')).toBe(1)
    expect(count(html, "No device matches “nokia 3310”")).toBe(1)
  })

  it("has no results list without a query", async () => {
    const html = await render({})
    expect(count(html, 'data-testid="device-results"')).toBe(0)
  })

  it("carries a valid returnTo into the choice form and drops an unsafe one", async () => {
    const ok = await render({ q: "ps5", returnTo: "/c/cases?sort=price" })
    expect(ok).toContain('name="returnTo" value="/c/cases?sort=price"')
    const bad = await render({ q: "ps5", returnTo: "//evil.example" })
    expect(bad).not.toContain('name="returnTo"')
    const picker = await render({ q: "ps5", returnTo: "/devices/" })
    expect(picker).not.toContain('name="returnTo"')
  })

  it("posts choices and clearing to the device routes (no server actions)", async () => {
    current.device = { slug: "iphone-15-pro", model: "iPhone 15 Pro" }
    const html = await render({ q: "15 pro" })
    expect(html).toContain('action="/api/device" method="post"')
    expect(html).toContain('action="/api/device/clear" method="post"')
  })

  it("marks the current device", async () => {
    current.device = { slug: "iphone-15-pro", model: "iPhone 15 Pro" }
    const html = await render({ q: "15 pro" })
    expect(html).toMatch(/aria-current="true"[^>]*value="iphone-15-pro"|value="iphone-15-pro"[^>]*aria-current="true"/)
  })
})
