import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const loadConfig = () => {
  const path = require.resolve("../../next.config.js")
  delete require.cache[path]
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(path)
}

const hosts = (config: { images: { remotePatterns: { hostname: string }[] } }) =>
  config.images.remotePatterns.map((p) => p.hostname)

describe("next.config images", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY", "pk_test"))
  afterEach(() => vi.unstubAllEnvs())

  it("allows the backend host and the configured image host", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDUSA_BACKEND_URL", "http://localhost:9003")
    vi.stubEnv("NEXT_PUBLIC_IMAGE_HOSTNAME", "files.technest.co.uk")
    const h = hosts(loadConfig())
    expect(h).toContain("localhost")
    expect(h).toContain("files.technest.co.uk")
  })

  it("uses the same default backend port as the SDK when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDUSA_BACKEND_URL", "")
    const patterns = loadConfig().images.remotePatterns as { hostname: string; port?: string }[]
    expect(patterns[0]).toMatchObject({ hostname: "localhost", port: "9000" })
  })

  it("allows Medusa's demo image bucket outside production only", () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(hosts(loadConfig())).toContain("medusa-public-images.s3.eu-west-1.amazonaws.com")
    vi.stubEnv("NODE_ENV", "production")
    expect(hosts(loadConfig())).not.toContain("medusa-public-images.s3.eu-west-1.amazonaws.com")
  })
})

describe("next.config redirects (old starter routes, 308)", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY", "pk_test"))
  afterEach(() => vi.unstubAllEnvs())

  it("sends /products, /categories and /store to the new routes permanently", async () => {
    const redirects = await loadConfig().redirects()
    expect(redirects).toEqual([
      { source: "/products/:handle", destination: "/p/:handle", permanent: true },
      { source: "/categories/:path+", destination: "/c/:path+", permanent: true },
      { source: "/store", destination: "/search", permanent: true },
    ])
  })
})
