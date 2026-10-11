// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/script", () => ({ default: () => null }))

import Turnstile from "./turnstile"

const renderWidget = vi.fn((_el: HTMLElement, _opts: Record<string, unknown>) => "widget_1")

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA")
  renderWidget.mockClear()
  window.turnstile = { render: renderWidget, reset: vi.fn(), remove: vi.fn() }
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe("Turnstile", () => {
  it("names the form it protects, so a token solved on another form is refused by the backend", () => {
    render(<Turnstile action="repair-booking" />)
    expect(renderWidget).toHaveBeenCalledTimes(1)
    const options = renderWidget.mock.calls[0][1]
    expect(options.action).toBe("repair-booking")
    expect(options["response-field-name"]).toBe("cf-turnstile-response")
  })
})
