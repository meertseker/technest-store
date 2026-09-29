import profile from "@/content/google-profile.json"

export type DayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday"

/** opens/closes are "HH:MM" in London time; null means closed that day */
export type DayHours = {
  day: DayName
  opens: string | null
  closes: string | null
}

const DAYS: DayName[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

const to24 = (h: string, m: string | undefined, ampm: string) => {
  let hour = parseInt(h, 10) % 12
  if (ampm === "pm") hour += 12
  return `${String(hour).padStart(2, "0")}:${m ?? "00"}`
}

const TIME = "(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)"
const RANGE = new RegExp(`${TIME}\\s*[–-]\\s*${TIME}`, "i")

/**
 * Parses one Google Business Profile hours line, e.g. "Tuesday 9 am–8 pm".
 * Returns null for a line without a known day so a changed export can never
 * crash the pages that import siteConfig.
 */
export function parseHoursLine(line: string): DayHours | null {
  const day = DAYS.find((d) => line.startsWith(d))
  if (!day) return null
  const rest = line.slice(day.length).trim()
  if (/open 24 hours/i.test(rest)) return { day, opens: "00:00", closes: "24:00" }
  const m = rest.match(RANGE)
  if (!m) return { day, opens: null, closes: null }
  return {
    day,
    opens: to24(m[1], m[2], m[3].toLowerCase()),
    closes: to24(m[4], m[5], m[6].toLowerCase()),
  }
}

/** "09:00" -> "9am", "17:30" -> "5:30pm" */
export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  const suffix = h >= 12 && h < 24 ? "pm" : "am"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${suffix}`
}

// "Unit 2A, Southwark Park Rd., London SE16 3TU" -> parts
const [line1, line2Raw, cityPostcode] = profile.address
  .split(",")
  .map((s) => s.trim())
const postcode =
  cityPostcode.match(/[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i)?.[0] ?? ""
const locality = cityPostcode.replace(postcode, "").trim()

/** Monday..Sunday from hours lines; unparseable lines are skipped, missing days are closed */
export function buildWeek(lines: string[]): DayHours[] {
  const byDay = new Map<DayName, DayHours>()
  for (const line of lines) {
    const parsed = parseHoursLine(line)
    if (parsed) byDay.set(parsed.day, parsed)
  }
  return DAYS.map((d) => byDay.get(d) ?? { day: d, opens: null, closes: null })
}

/** The shop's facts, built once from the Google Business Profile export */
export const siteConfig = {
  name: profile.name,
  legalName: null as string | null, // [LEAD?] pending
  vatNumber: null as string | null, // [LEAD?] pending
  phone: {
    display: profile.phone,
    e164: `+44${profile.phone.replace(/\s/g, "").replace(/^0/, "")}`,
  },
  email: null as string | null, // not in the Google profile; [LEAD?] before publishing one
  address: {
    line1,
    line2: line2Raw.replace(/\.$/, ""),
    locality,
    postcode,
    country: "GB" as const,
    oneLine: profile.address,
  },
  geo: { lat: profile.coordinates.lat, lng: profile.coordinates.lng },
  mapsUrl: profile.links.maps,
  rating: { value: profile.rating, count: profile.review_count },
  hours: buildWeek(profile.opening_hours),
}

const londonParts = (now: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return { day: get("weekday") as DayName, time: `${get("hour")}:${get("minute")}` }
}

/** Open/closed label for the shop at `now`, always evaluated in London time */
export function getOpenStatus(now: Date, hours: DayHours[] = siteConfig.hours) {
  const { day, time } = londonParts(now)
  const idx = DAYS.indexOf(day)
  const today = hours[idx]
  const open =
    !!today.opens && !!today.closes && time >= today.opens && time < today.closes
  if (open) {
    return { open, today, label: `Open now · until ${formatTime(today.closes!)}` }
  }
  if (today.opens && time < today.opens) {
    return {
      open,
      today,
      label: `Closed now · opens ${formatTime(today.opens)} today`,
    }
  }
  for (let i = 1; i <= 7; i++) {
    const next = hours[(idx + i) % 7]
    if (next.opens) {
      const when = i === 1 ? "tomorrow" : next.day
      return {
        open,
        today,
        label: `Closed now · opens ${formatTime(next.opens)} ${when}`,
      }
    }
  }
  return { open, today, label: "Closed now" }
}
