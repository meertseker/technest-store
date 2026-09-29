import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { contrastRatio, tokens } from "./tokens"

const css = readFileSync(join(__dirname, "../../styles/globals.css"), "utf8")

describe("design tokens", () => {
  it("defines .content-container once, with the spec's 1280px width", () => {
    const rules = css.match(/\.content-container\s*\{[^}]*\}/g) ?? []
    expect(rules).toHaveLength(1)
    expect(rules[0]).toContain("max-w-[1280px]")
  })

  it("CSS variables match tokens.ts", () => {
    for (const [name, hex] of Object.entries(tokens)) {
      expect(css).toMatch(new RegExp(`--${name}:\\s*${hex};`, "i"))
    }
  })

  it.each([
    ["brand", "background", 4.5],
    ["brand-foreground", "brand", 4.5],
    ["foreground", "surface", 4.5],
    ["muted-foreground", "surface", 4.5],
    ["success", "success-subtle", 4.5],
    ["warning", "warning-subtle", 4.5],
    ["destructive", "background", 4.5],
    ["brand", "brand-subtle", 4.5],
    ["border-strong", "surface", 3],
    ["ring", "background", 3],
  ] as const)("%s on %s >= %s:1", (fg, bg, min) => {
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min)
  })
})
