import type { siteConfig as SiteConfigValue } from "@/lib/site-config"

type SiteConfig = typeof SiteConfigValue

/** schema.org Store/MobilePhoneStore for the shop. No aggregateRating: Google
 * treats a business rating its own site publishes as self-serving. */
export function buildLocalBusinessJsonLd(config: SiteConfig, baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": ["Store", "MobilePhoneStore"],
    name: config.name,
    url: baseUrl,
    telephone: config.phone.e164,
    email: config.email,
    image: `${baseUrl}/images/shop/shopfront.jpg`,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${config.address.line1}, ${config.address.line2}`,
      addressLocality: config.address.locality,
      postalCode: config.address.postcode,
      addressCountry: config.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: config.geo.lat,
      longitude: config.geo.lng,
    },
    hasMap: config.mapsUrl,
    openingHoursSpecification: config.hours
      .filter((h) => h.opens && h.closes)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${h.day}`,
        opens: h.opens,
        closes: h.closes,
      })),
    priceRange: "£",
  }
}
