import { adminUrl } from "../password-reset-email"

describe("adminUrl (staff password reset link)", () => {
  it("prefers ADMIN_URL", () => {
    expect(adminUrl({ ADMIN_URL: "https://admin.technestlondon.co.uk/app/", MEDUSA_BACKEND_URL: "https://api.x" } as any)).toBe(
      "https://admin.technestlondon.co.uk/app"
    )
  })

  it("falls back to the backend's shop panel", () => {
    expect(adminUrl({ MEDUSA_BACKEND_URL: "https://api.technestlondon.co.uk" } as any)).toBe("https://api.technestlondon.co.uk/panel")
  })

  it("refuses to guess a host in production", () => {
    expect(() => adminUrl({ NODE_ENV: "production" } as any)).toThrow(/ADMIN_URL/)
  })
})
