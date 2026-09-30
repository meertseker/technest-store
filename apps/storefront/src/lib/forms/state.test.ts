import { describe, expect, it } from "vitest"
import { errorState, initialFormState, safeReturnTo, withoutSecrets } from "./state"
import { loginErrorMessage, registerErrorMessage } from "./auth-messages"

describe("safeReturnTo", () => {
  it("keeps same-site paths", () => {
    expect(safeReturnTo("/trade/apply")).toBe("/trade/apply")
    expect(safeReturnTo("/account/orders?page=2")).toBe("/account/orders?page=2")
  })

  it("rejects anything that could leave the site", () => {
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "evil", "", null, undefined, "/a\nb"]) {
      expect(safeReturnTo(bad)).toBe("/account")
    }
    expect(safeReturnTo("/" + "a".repeat(600))).toBe("/account")
  })
})

describe("form state", () => {
  it("counts attempts so the error summary refocuses on each failed submit", () => {
    const one = errorState(initialFormState, { a: "1" }, { a: "bad" })
    const two = errorState(one, { a: "1" }, { a: "bad" })
    expect(one.attempt).toBe(1)
    expect(two.attempt).toBe(2)
    expect(two.status).toBe("error")
  })

  it("never echoes passwords or tokens", () => {
    expect(withoutSecrets({ email: "a@b.co", password: "x", confirm_password: "x", token: "t" })).toEqual({
      email: "a@b.co",
    })
  })
})

describe("auth messages", () => {
  it("maps Medusa errors to plain words and never repeats the raw text", () => {
    expect(loginErrorMessage("Error: Invalid email or password")).toMatch(/incorrect/)
    expect(loginErrorMessage("TypeError: fetch failed")).toMatch(/could not reach/)
    expect(loginErrorMessage("something about sam@example.com")).not.toContain("sam@example.com")
    expect(registerErrorMessage("Identity with email already exists")).toMatch(/already exists/)
  })
})
