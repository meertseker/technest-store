import { customerResetUrl } from "../password-reset-email"

describe("customerResetUrl", () => {
  const env = process.env.STOREFRONT_URL
  beforeEach(() => {
    process.env.STOREFRONT_URL = "https://technest.co.uk"
  })
  afterEach(() => {
    if (env === undefined) delete process.env.STOREFRONT_URL
    else process.env.STOREFRONT_URL = env
  })

  it("carries the token only: the address is not in the link (it ends up in proxy logs)", () => {
    const url = customerResetUrl("tok.en+/=")
    expect(url).toBe("https://technest.co.uk/account/reset-password?token=tok.en%2B%2F%3D")
    expect(url).not.toMatch(/email=|sam|example\.com/)
  })

  it("is an https link to the storefront's reset page", () => {
    expect(new URL(customerResetUrl("t")).pathname).toBe("/account/reset-password")
    expect(customerResetUrl("t").startsWith("https://")).toBe(true)
  })
})
