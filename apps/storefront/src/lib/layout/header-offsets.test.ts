import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const SRC = join(__dirname, "../..")
const css = readFileSync(join(SRC, "styles/globals.css"), "utf8")

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : /\.tsx$/.test(e.name) && !/\.test\./.test(e.name)
        ? [join(dir, e.name)]
        : []
  )

/**
 * The header is two rows at every width (main row + device chip row on a
 * phone, main row + Shop/Repairs/Trade row from 1024px). Anything that sticks
 * below it must clear both rows, or it slides under the second one.
 */
describe("sticky offsets below the two-row header", () => {
  it("globals.css defines the full header height once", () => {
    expect(css).toMatch(/--header-stack:\s*calc\(var\(--header-h\) \+ 53px\);/)
  })

  it("no component sticks below only the first header row", () => {
    const offenders = sources(SRC).filter((file) =>
      /top-\[calc\(var\(--header-h\)/.test(readFileSync(file, "utf8"))
    )
    expect(offenders.map((f) => f.slice(SRC.length + 1).replace(/\\/g, "/"))).toEqual([])
  })
})
