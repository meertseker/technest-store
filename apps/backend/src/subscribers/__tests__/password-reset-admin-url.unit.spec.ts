import { adminUrl } from "../password-reset-email"

describe("adminUrl (staff password reset link)", () => {
  it("prefers ADMIN_URL", () => {
    expect(adminUrl({ ADMIN_URL: "https://admin.technest.co.uk/app/", MEDUSA_BACKEND_URL: "https://api.x" } as any)).toBe(
      "https://admin.technest.co.uk/app"
    )
  })

  it("falls back to the backend's /app", () => {
    expect(adminUrl({ MEDUSA_BACKEND_URL: "https://api.technest.co.uk" } as any)).toBe("https://api.technest.co.uk/app")
  })

  it("refuses to guess a host in production", () => {
    expect(() => adminUrl({ NODE_ENV: "production" } as any)).toThrow(/ADMIN_URL/)
  })
})
