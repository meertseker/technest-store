import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { JsonLd } from "./json-ld"

describe("JsonLd", () => {
  it("cannot be broken out of by a closing script tag in the data", () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { data: { name: "</script><script>alert(1)</script>" } })
    )
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    const json = html.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "")
    expect(JSON.parse(json).name).toBe("</script><script>alert(1)</script>")
  })
})
