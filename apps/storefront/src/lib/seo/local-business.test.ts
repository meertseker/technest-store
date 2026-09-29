import { describe, expect, it } from "vitest"
import { siteConfig } from "@/lib/site-config"
import { buildLocalBusinessJsonLd } from "./local-business"

type Ld = Record<string, unknown> & {
  openingHoursSpecification: Record<string, unknown>[]
}

describe("buildLocalBusinessJsonLd", () => {
  const ld = buildLocalBusinessJsonLd(siteConfig, "https://technest.co.uk") as Ld

  it("describes the shop", () => {
    expect(ld["@context"]).toBe("https://schema.org")
    expect(ld["@type"]).toEqual(["Store", "MobilePhoneStore"])
    expect(ld.telephone).toBe("+447775669000")
    expect(ld.address).toMatchObject({
      "@type": "PostalAddress",
      postalCode: "SE16 3TU",
      addressCountry: "GB",
    })
    expect(ld.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 51.4923393,
      longitude: -0.0643359,
    })
    expect(ld.url).toBe("https://technest.co.uk")
    expect(ld.hasMap).toBe(siteConfig.mapsUrl)
  })

  it("has one opening spec per open day", () => {
    const sunday = ld.openingHoursSpecification.find(
      (s) => s.dayOfWeek === "https://schema.org/Sunday"
    )
    expect(sunday).toEqual({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "https://schema.org/Sunday",
      opens: "11:00",
      closes: "17:00",
    })
    expect(ld.openingHoursSpecification).toHaveLength(7)
  })

  it("omits email while none is confirmed", () => {
    expect("email" in ld).toBe(false)
  })

  it("includes email once one is configured", () => {
    const withEmail = buildLocalBusinessJsonLd(
      { ...siteConfig, email: "shop@example.com" },
      "https://technest.co.uk"
    ) as Ld
    expect(withEmail.email).toBe("shop@example.com")
  })

  it("does not claim a rating (self-serving LocalBusiness reviews are ineligible)", () => {
    expect(ld.aggregateRating).toBeUndefined()
  })
})
