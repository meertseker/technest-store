// Lives outside src/search: Medusa imports files under src/search as index definitions.
import { normaliseSearchText, synonymsFor } from "../../search/helpers/synonyms"

describe("normaliseSearchText", () => {
  it("lower-cases and turns punctuation into spaces", () => {
    expect(normaliseSearchText("20W USB-C Fast Wall Charger")).toBe("20w usb c fast wall charger")
  })
})

describe("synonymsFor", () => {
  it("makes a charger findable as plug and adapter (one way)", () => {
    const added = synonymsFor(["20W USB-C Fast Wall Charger"])
    expect(added).toEqual(expect.arrayContaining(["plug", "adapter"]))
    // USB-C also adds its spellings.
    expect(added).toEqual(expect.arrayContaining(["type c", "usbc"]))
    // An adapter does not become a charger.
    expect(synonymsFor(["USB-C to USB-A Adapter (2-pack)"])).not.toContain("charger")
  })

  it("expands interchangeable groups both ways, plurals included", () => {
    expect(synonymsFor(["USB-C to Lightning Cable"])).toEqual(
      expect.arrayContaining(["lead", "wire"])
    )
    expect(synonymsFor(["True Wireless Earbuds"])).toEqual(
      expect.arrayContaining(["earphones", "headphones"])
    )
    expect(synonymsFor(["Wired USB-C Earphones"])).toContain("earbuds")
    expect(synonymsFor(["Clear Shockproof Case"])).toContain("cover")
    expect(synonymsFor(["Cases"])).toContain("cover")
  })

  it("covers screen protectors, Apple, power banks and USB-C", () => {
    expect(synonymsFor(["Privacy Glass Screen Protector"])).toContain("tempered glass")
    expect(synonymsFor(["Tempered Glass Screen Protector (2-pack)"])).toContain("screen guard")
    expect(synonymsFor(["Model:iPhone 15"])).toContain("apple")
    expect(synonymsFor(["10,000mAh Slim Power Bank 20W"])).toContain("portable charger")
    expect(synonymsFor(["Type-C cable"])).toContain("usb-c")
  })

  it("adds nothing the text already has, and nothing for unrelated text", () => {
    expect(synonymsFor(["Lead cable"])).not.toContain("lead")
    expect(synonymsFor(["Wireless Mouse"])).toEqual([])
    expect(synonymsFor([null, undefined, ""])).toEqual([])
  })

  it("adds terms found only in unsearched context (category names, tags)", () => {
    expect(synonymsFor(["True Wireless Earbuds"], ["Earphones"])).toContain("earphones")
    expect(synonymsFor(["Clear Shockproof Case"], ["Cases"])).toContain("cover")
  })

  it("matches whole words only", () => {
    // "wire" must not be read out of "wireless".
    expect(synonymsFor(["Wireless Mouse"])).not.toContain("cable")
  })
})
