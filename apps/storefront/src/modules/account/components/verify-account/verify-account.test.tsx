// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

let token: string | null = null
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(token ? { token } : {}),
}))
const confirmEmailVerification = vi.fn()
vi.mock("@lib/data/customer", () => ({
  confirmEmailVerification: (...a: unknown[]) => confirmEmailVerification(...a),
}))

import VerifyAccount from "."

afterEach(() => {
  cleanup()
  token = null
  confirmEmailVerification.mockReset()
})

describe("<VerifyAccount>", () => {
  it("says the link is no good and offers sign-in, as a link (not a button inside a link)", async () => {
    render(<VerifyAccount />)
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("This link is invalid or has expired")
    const link = screen.getByRole("link", { name: "Go to sign in" })
    expect(link.getAttribute("href")).toBe("/account/login")
    expect(link.querySelector("button")).toBeNull()
    expect(confirmEmailVerification).not.toHaveBeenCalled()
  })

  it("confirms the email once and says it worked", async () => {
    token = "tok_1"
    confirmEmailVerification.mockResolvedValue({ success: true })
    render(<VerifyAccount />)
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Your email is verified"))
    expect(confirmEmailVerification).toHaveBeenCalledTimes(1)
    expect(confirmEmailVerification).toHaveBeenCalledWith("tok_1")
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/account/login")
  })

  it("has one page heading in sentence case", () => {
    render(<VerifyAccount />)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Verify your email")
  })
})
