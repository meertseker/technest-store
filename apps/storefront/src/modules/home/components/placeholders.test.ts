import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { HttpTypes } from "@medusajs/types"
import Gallery from "@modules/catalogue/pdp/gallery"
import LineThumb from "@modules/basket/components/line-thumb"
import CategoryTiles from "./category-tiles"
import ProductCard from "./product-card"

const product = (over: Record<string, unknown>) =>
  ({ id: "p", handle: "p", title: "Thing", thumbnail: null, variants: [], ...over }) as unknown as HttpTypes.StoreProduct

const iconOf = (html: string) => html.match(/data-placeholder-icon="([a-z]+)"/)?.[1] ?? null

describe("no-photo placeholders", () => {
  it("a product card without a photo shows an icon for what the product is", () => {
    const html = renderToStaticMarkup(
      createElement(ProductCard, { product: product({ title: "Tempered Glass Screen Protector" }) })
    )
    expect(iconOf(html)).toBe("shield")
  })

  it("falls back to the product's category when the title says nothing", () => {
    const html = renderToStaticMarkup(
      createElement(ProductCard, {
        product: product({ title: "Model X200", categories: [{ id: "c", handle: "controllers", name: "Controllers" }] }),
      })
    )
    expect(iconOf(html)).toBe("gamepad")
  })

  it("a product card with a photo has no placeholder", () => {
    const html = renderToStaticMarkup(
      createElement(ProductCard, { product: product({ thumbnail: "https://cdn.example/p.jpg" }) })
    )
    expect(iconOf(html)).toBeNull()
    expect(html).toContain("<img")
  })

  it("the product page says the photo is coming and shows the same icon", () => {
    const html = renderToStaticMarkup(createElement(Gallery, { images: [], title: "USB-C Cable", placeholderIcon: "cable" }))
    expect(iconOf(html)).toBe("cable")
    expect(html).toContain("Photo coming soon")
  })

  it("a basket line without a photo uses the item's title", () => {
    expect(iconOf(renderToStaticMarkup(createElement(LineThumb, { src: null, title: "Wireless Mouse" })))).toBe("keyboard")
  })
})

describe("<CategoryTiles>", () => {
  const cats = [
    { id: "a", name: "Cases", handle: "cases" },
    { id: "b", name: "Speakers", handle: "speakers" },
  ] as unknown as HttpTypes.StoreProductCategory[]

  it("is a compact row of icon links while no category has a picture", () => {
    const html = renderToStaticMarkup(createElement(CategoryTiles, { categories: cats }))
    expect(html).toContain('data-layout="compact"')
    expect(html).not.toContain("<img")
    expect(html).toContain('href="/c/cases"')
    expect(html).toContain('data-placeholder-icon="speaker"')
  })

  it("switches every tile to the picture layout once an admin adds one", () => {
    const withImage = [
      { ...cats[0], metadata: { image_url: "https://cdn.example/cases.jpg" } },
      cats[1],
    ] as unknown as HttpTypes.StoreProductCategory[]
    const html = renderToStaticMarkup(createElement(CategoryTiles, { categories: withImage }))
    expect(html).toContain('data-layout="image"')
    expect(html).toContain("<img")
  })
})
