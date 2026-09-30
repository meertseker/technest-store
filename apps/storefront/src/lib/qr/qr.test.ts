import { describe, expect, it } from "vitest"
import { qrMatrix } from "./qr"

describe("qrMatrix", () => {
  it("encodes the shop URL as a square QR code", () => {
    const { size, path } = qrMatrix("https://technest.co.uk/")
    // version 2 (25x25) or 3 (29x29) for a short URL at level M
    expect([25, 29]).toContain(size)
    expect(path).toMatch(/^(M\d+ \d+h1v1h-1z)+$/)
  })

  it("draws the three finder patterns (top-left module is dark)", () => {
    const { size, path } = qrMatrix("https://technest.co.uk/")
    expect(path.startsWith("M0 0h1v1h-1z")).toBe(true)
    expect(path).toContain(`M${size - 1} 0h1v1h-1z`)
    expect(path).toContain(`M0 ${size - 1}h1v1h-1z`)
  })

  it("is deterministic", () => {
    expect(qrMatrix("https://technest.co.uk/")).toEqual(qrMatrix("https://technest.co.uk/"))
  })
})
