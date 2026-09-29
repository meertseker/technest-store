import { describe, expect, it } from "vitest"
import { resolveBackendUrl } from "./backend-url"

describe("resolveBackendUrl", () => {
  const env = {
    MEDUSA_BACKEND_URL: "http://server:9000",
    NEXT_PUBLIC_MEDUSA_BACKEND_URL: "https://api.technest.co.uk",
  }

  it("uses the internal URL on the server", () => {
    expect(resolveBackendUrl(true, env)).toBe("http://server:9000")
  })

  it("uses the public URL in the browser", () => {
    expect(resolveBackendUrl(false, env)).toBe("https://api.technest.co.uk")
  })

  it("falls back to the public URL on the server when no internal URL is set", () => {
    expect(
      resolveBackendUrl(true, { NEXT_PUBLIC_MEDUSA_BACKEND_URL: "https://api.technest.co.uk" })
    ).toBe("https://api.technest.co.uk")
  })

  it("falls back to the Medusa default when nothing is set", () => {
    expect(resolveBackendUrl(false, {})).toBe("http://localhost:9000")
  })
})
