// Shop facts used in every email footer. Colours are the tokens in docs/specs/design.md.
// Source: google-business-profile/profile.json
// and the team brief. LEGAL_NAME is pending the lead's answer (Ltd name / company no.).
export const BRAND = {
  name: "Tech Nest",
  legalName: "Tech Nest",
  address: "Unit 2A, Southwark Park Rd., London SE16 3TU",
  phone: "07775 669000",
  email: "hello@technest.co.uk",
  accent: "#D6001C",
  text: "#111827",
  muted: "#4B5563",
  border: "#E3E6EA",
  surface: "#F6F7F9",
  success: "#166534",
  destructive: "#B91C1C",
} as const

export const storefrontUrl = () =>
  (process.env.STOREFRONT_URL || "https://technest.co.uk").replace(/\/$/, "")
