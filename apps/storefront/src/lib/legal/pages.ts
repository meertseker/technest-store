/** The legal pages served at /legal/[slug]. Order = order of the index list. */
export const LEGAL_PAGES = [
  {
    slug: "terms",
    title: "Terms and conditions",
    description: "The terms that apply when you buy from Tech Nest online or collect from our shop.",
  },
  {
    slug: "delivery",
    title: "Delivery and Click & Collect",
    description: "Delivery options, prices, free delivery and how Click & Collect works.",
  },
  {
    slug: "returns",
    title: "Returns and cancellations",
    description:
      "Your 14-day right to cancel, how to return an item by post or in our shop, and faulty goods.",
  },
  {
    slug: "privacy",
    title: "Privacy notice",
    description: "What personal data Tech Nest collects, why, who we share it with and your rights.",
  },
  {
    slug: "cookies",
    title: "Cookie policy",
    description: "The cookies this website uses and how to change your cookie choice.",
  },
  {
    slug: "accessibility",
    title: "Accessibility statement",
    description: "How accessible this website is, known issues and how to contact us.",
  },
  {
    slug: "weee",
    title: "Recycling old electricals (WEEE)",
    description: "How to recycle old electrical items and batteries, including free take-back at our shop.",
  },
  {
    slug: "repair-terms",
    title: "Repair terms",
    description: "The terms that apply when Tech Nest repairs your phone, tablet, console or computer.",
  },
] as const

export type LegalSlug = (typeof LEGAL_PAGES)[number]["slug"]

export const getLegalPage = (slug: string) =>
  LEGAL_PAGES.find((p) => p.slug === slug) ?? null
