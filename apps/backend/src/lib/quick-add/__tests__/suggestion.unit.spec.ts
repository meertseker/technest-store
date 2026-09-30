import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import sharp from "sharp"
import { mapError, QUICK_ADD_MODEL } from "../claude"
import { CLAUDE_IMAGE_LONG_EDGE, ImageUnreadableError, prepareImageForClaude } from "../image"
import {
  catalogueText,
  ClaudeProductDraft,
  mapSuggestion,
  QuickAddCatalogue,
} from "../suggestion"

const catalogue: QuickAddCatalogue = {
  categories: [
    {
      id: "pcat_chargers",
      handle: "chargers-cables",
      name: "Chargers & Cables",
      parent_category: { handle: "phone-accessories", name: "Phone Accessories" },
    },
    { id: "pcat_cases", handle: "cases", name: "Cases", parent_category: null },
  ],
  devices: [
    { id: "dev_1", slug: "iphone-15", brand: "Apple", model: "iPhone 15" },
    { id: "dev_2", slug: "galaxy-s24", brand: "Samsung", model: "Galaxy S24" },
  ],
}

const draft = (over: Partial<ClaudeProductDraft> = {}): ClaudeProductDraft => ({
  is_product_photo: true,
  title: "Anker 20W USB-C Wall Charger",
  description: "Compact 20W USB-C charger.",
  category_handle: "chargers-cables",
  product_type: "charger",
  compatible_device_slugs: ["iphone-15"],
  safety_marking: "UKCA",
  safety_marking_evidence: "UKCA mark on the back of the box",
  connector_a: "USB-C",
  connector_b: null,
  wattage: 20,
  cable_length_m: null,
  suggested_price_gbp: 14.99,
  looks_like_vape: false,
  confidence: "high",
  notes: "",
  ...over,
})

describe("ClaudeProductDraft schema", () => {
  it("parses a valid model answer and rejects missing or unknown values", () => {
    expect(ClaudeProductDraft.parse(draft())).toEqual(draft())
    expect(() => ClaudeProductDraft.parse({ ...draft(), product_type: "toaster" })).toThrow()
    expect(() => ClaudeProductDraft.parse({ ...draft(), safety_marking: "FCC" })).toThrow()
    const { title: _omit, ...noTitle } = draft()
    expect(() => ClaudeProductDraft.parse(noTitle)).toThrow()
  })

  it("becomes a strict JSON schema for structured outputs, parsed by the SDK", () => {
    const format = betaZodOutputFormat(ClaudeProductDraft)
    expect(format.type).toBe("json_schema")
    const schema = format.schema as any
    expect(schema.type).toBe("object")
    expect(schema.additionalProperties).toBe(false)
    expect([...schema.required].sort()).toEqual(Object.keys(draft()).sort())
    expect(format.parse(JSON.stringify(draft()))).toEqual(draft())
    expect(() => format.parse('{"title": 1}')).toThrow()
  })
})

describe("mapSuggestion", () => {
  it("maps known category and devices, keeps the price in major units and never confirms the marking", () => {
    const s = mapSuggestion(draft(), catalogue)
    expect(s.category).toEqual({ id: "pcat_chargers", handle: "chargers-cables", name: "Chargers & Cables" })
    expect(s.devices).toEqual([{ id: "dev_1", slug: "iphone-15", name: "Apple iPhone 15" }])
    expect(s.suggested_price).toEqual({ amount: 14.99, currency_code: "gbp", is_suggestion: true })
    expect(s.safety_marking).toEqual({
      guess: "UKCA",
      evidence: "UKCA mark on the back of the box",
      confirmed: false,
      required_to_publish: true,
    })
    expect(s.attributes).toEqual({ connector_a: "USB-C", connector_b: null, wattage: 20, cable_length_m: null })
    expect(s.warnings).toEqual([])
  })

  it("drops unknown handles and slugs, de-duplicates devices", () => {
    const s = mapSuggestion(
      draft({
        category_handle: "toasters",
        compatible_device_slugs: ["galaxy-s24", "nokia-3310", "galaxy-s24", " iphone-15 "],
      }),
      catalogue
    )
    expect(s.category).toBeNull()
    expect(s.devices.map((d) => d.id)).toEqual(["dev_2", "dev_1"])
    expect(s.warnings).toContain("The suggested category doesn't exist here; pick one.")
  })

  it("rejects implausible prices and rounds to pence", () => {
    expect(mapSuggestion(draft({ suggested_price_gbp: -3 }), catalogue).suggested_price).toBeNull()
    expect(mapSuggestion(draft({ suggested_price_gbp: 0 }), catalogue).suggested_price).toBeNull()
    expect(mapSuggestion(draft({ suggested_price_gbp: 99999 }), catalogue).suggested_price).toBeNull()
    expect(mapSuggestion(draft({ suggested_price_gbp: null }), catalogue).suggested_price).toBeNull()
    expect(mapSuggestion(draft({ suggested_price_gbp: 3.499 }), catalogue).suggested_price?.amount).toBe(3.5)
  })

  it("warns when a charger has no marking, and on vapes or non-product photos", () => {
    const noMark = mapSuggestion(draft({ safety_marking: "none" }), catalogue)
    expect(noMark.safety_marking.required_to_publish).toBe(true)
    expect(noMark.warnings.join(" ")).toMatch(/UKCA or CE/)

    const caseDraft = mapSuggestion(draft({ category_handle: "cases", safety_marking: "none" }), catalogue)
    expect(caseDraft.safety_marking.required_to_publish).toBe(false)
    expect(caseDraft.warnings).toEqual([])

    const vape = mapSuggestion(draft({ title: "Elf Bar 600 disposable vape", looks_like_vape: false }), catalogue)
    expect(vape.looks_like_vape).toBe(true)
    expect(vape.warnings.join(" ")).toMatch(/vape/i)

    expect(mapSuggestion(draft({ is_product_photo: false }), catalogue).warnings.join(" ")).toMatch(
      /No product was recognised/
    )
  })

  it("clips long text", () => {
    const s = mapSuggestion(draft({ title: "x".repeat(500), description: "y".repeat(5000) }), catalogue)
    expect(s.title).toHaveLength(120)
    expect(s.description).toHaveLength(2000)
  })
})

describe("catalogueText", () => {
  it("lists categories and devices in a stable order", () => {
    const text = catalogueText(catalogue)
    expect(text).toContain("- cases: Cases")
    expect(text).toContain("- chargers-cables: Chargers & Cables (in Phone Accessories)")
    expect(text.indexOf("cases:")).toBeLessThan(text.indexOf("chargers-cables:"))
    expect(text).toContain("- galaxy-s24: Samsung Galaxy S24")
    expect(catalogueText({ ...catalogue, devices: [...catalogue.devices].reverse() })).toBe(text)
  })
})

describe("mapError", () => {
  const headers = new Headers()
  it.each([
    [new Anthropic.APIConnectionTimeoutError(), "ai_timeout"],
    [new Anthropic.AuthenticationError(401, undefined, "bad key", headers), "ai_unavailable"],
    [new Anthropic.RateLimitError(429, undefined, "slow down", headers), "ai_unavailable"],
    [new Anthropic.BadRequestError(400, undefined, "bad image", headers), "ai_bad_response"],
    [new Anthropic.InternalServerError(500, undefined, "boom", headers), "ai_unavailable"],
    [new Anthropic.APIConnectionError({ message: "refused" }), "ai_unavailable"],
    [new Anthropic.AnthropicError("Failed to parse structured output"), "ai_bad_response"],
    [new Error("other"), "ai_unavailable"],
  ])("maps %p", (error, code) => {
    const result = mapError(error)
    expect(result).toMatchObject({ ok: false, code })
  })

  it("never echoes the upstream message", () => {
    const result = mapError(new Anthropic.AuthenticationError(401, undefined, "key sk-ant-123 invalid", headers))
    expect(JSON.stringify(result)).not.toContain("sk-ant")
  })
})

describe("prepareImageForClaude", () => {
  it("downsizes to the long edge as JPEG and applies EXIF rotation", async () => {
    const input = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#336699" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer()
    const out = await prepareImageForClaude(input)
    expect(out.media_type).toBe("image/jpeg")
    // Orientation 6 = rotated 90 degrees: portrait after rotation.
    expect(out.height).toBe(CLAUDE_IMAGE_LONG_EDGE)
    expect(out.width).toBe(1176)
    const meta = await sharp(Buffer.from(out.data, "base64")).metadata()
    expect(meta.format).toBe("jpeg")
  })

  it("never enlarges small photos", async () => {
    const input = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#fff" } }).png().toBuffer()
    const out = await prepareImageForClaude(input)
    expect([out.width, out.height]).toEqual([800, 600])
  })

  it("rejects non-images", async () => {
    await expect(prepareImageForClaude(Buffer.from("not an image"))).rejects.toBeInstanceOf(ImageUnreadableError)
  })

  it("uses the current Claude model id", () => {
    expect(QUICK_ADD_MODEL).toBe("claude-opus-5-5")
  })
})
