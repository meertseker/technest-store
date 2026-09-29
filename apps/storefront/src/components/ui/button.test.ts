import { describe, expect, it } from "vitest"
import { buttonVariants } from "./button"

describe("buttonVariants", () => {
  it("defaults to the red primary button at 48px", () => {
    const cls = buttonVariants()
    expect(cls).toContain("bg-brand")
    expect(cls).toContain("hover:bg-brand-hover")
    expect(cls).toContain("min-h-12")
  })

  it("keeps every size at least 44px tall", () => {
    expect(buttonVariants({ size: "md" })).toContain("min-h-11")
    expect(buttonVariants({ size: "icon" })).toContain("size-11")
  })

  it("secondary uses a 3:1 border, not brand red", () => {
    const cls = buttonVariants({ variant: "secondary" })
    expect(cls).toContain("border-border-strong")
    expect(cls).not.toContain("bg-brand")
  })

  it("lets callers override classes without duplicates", () => {
    expect(buttonVariants({ className: "px-8" })).not.toMatch(/\bpx-6\b/)
  })
})
