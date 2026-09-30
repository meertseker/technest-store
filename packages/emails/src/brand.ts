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

// Opening hours from google-business-profile/profile.json, by weekday (0 = Sunday).
export const OPENING_HOURS = [
  "11am–5pm",
  "9am–8pm",
  "9am–8pm",
  "9am–8pm",
  "9am–8pm",
  "9am–8pm",
  "9am–8pm",
] as const

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/** "Today (Saturday): 9am–8pm", for the shop's own time zone. */
export function todaysHours(now: Date = new Date()): string {
  const name = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Europe/London" }).format(now)
  const day = WEEKDAYS.indexOf(name)
  return `Today (${name}): ${OPENING_HOURS[day]}`
}

/** Google Maps link for the shop (place id from profile.json). */
export const MAP_URL =
  "https://www.google.com/maps/search/?api=1&query=Tech%20Nest%2C%20Southwark%20Park%20Rd%2C%20London%20SE16%203TU&query_place_id=ChIJcR24n1UDdkgRr2HfXi6pF8w"
