/**
 * Form validation shared by the client (instant error summary) and the server
 * actions (never trust the browser). Rules mirror the backend contracts
 * (docs/contracts/trade.md, docs/contracts/repairs.md) so a form that passes
 * here is not rejected by the API for the same reason.
 *
 * Messages follow the GOV.UK pattern: say what to do, not what went wrong.
 */

export type FieldErrors = Record<string, string>
export type FormValues = Record<string, string>

/** Everything a form posts, as trimmed strings (files and repeated keys are ignored) */
export function readForm(formData: FormData, names: readonly string[]): FormValues {
  const out: FormValues = {}
  for (const name of names) {
    const v = formData.get(name)
    out[name] = typeof v === "string" ? v.trim() : ""
  }
  return out
}

// Deliberately simple: one "@", something either side, a dot in the domain.
// The backend (zod) is the final judge; this only catches typos early.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^[0-9 +()-]{5,40}$/
// UK postcode, space optional (GOV.UK/ONS pattern, simplified), plus BFPO excluded
const POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})$/i

export const isEmail = (v: string) => v.length <= 254 && EMAIL.test(v)
/** Contract: 5-40 chars, digits, spaces and +()- only */
export const isPhone = (v: string) => PHONE.test(v) && /\d{5,}/.test(v.replace(/\D/g, ""))
export const isUkPostcode = (v: string) => POSTCODE.test(v.trim())

/** "se163tu" -> "SE16 3TU"; returns the input unchanged if it is not a postcode */
export function formatUkPostcode(v: string) {
  const m = v.trim().toUpperCase().match(POSTCODE)
  return m ? `${m[1]} ${m[2]}` : v.trim()
}

/** Upper case, no spaces: "gb 123 4567 89" -> "GB123456789" */
export const normaliseId = (v: string) => v.replace(/\s+/g, "").toUpperCase()
/** Contract: ^(GB)?(\d{9}|\d{12})$ after normalising */
export const isVatNumber = (v: string) => /^(GB)?(\d{9}|\d{12})$/.test(normaliseId(v))
/** Contract: ^[A-Z0-9]{8}$ after normalising */
export const isCompaniesHouseNumber = (v: string) => /^[A-Z0-9]{8}$/.test(normaliseId(v))

type Rule = (value: string, all: FormValues) => string | null

const required = (msg: string): Rule => (v) => (v ? null : msg)
const maxLen = (n: number, msg: string): Rule => (v) => (v.length > n ? msg : null)
const when = (test: (v: string) => boolean, msg: string): Rule => (v) =>
  v && !test(v) ? msg : null

function run(values: FormValues, schema: Record<string, Rule[]>): FieldErrors {
  const errors: FieldErrors = {}
  for (const [name, rules] of Object.entries(schema)) {
    for (const rule of rules) {
      const msg = rule(values[name] ?? "", values)
      if (msg) {
        errors[name] = msg
        break
      }
    }
  }
  return errors
}

export const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0

const email = (label = "email address"): Rule[] => [
  required(`Enter your ${label}`),
  when(isEmail, `Enter an ${label} in the correct format, like name@example.com`),
]
const phone = (label = "phone number"): Rule[] => [
  required(`Enter your ${label}`),
  maxLen(40, `Phone number must be 40 characters or fewer`),
  when(isPhone, `Enter a phone number, like 07700 900123 or +44 20 7946 0000`),
]
const optionalPhone: Rule[] = [
  maxLen(40, "Phone number must be 40 characters or fewer"),
  when(isPhone, "Enter a phone number, like 07700 900123 or +44 20 7946 0000"),
]

export const PASSWORD_MIN = 8

// ---------------------------------------------------------------------------
// Accounts

export const LOGIN_FIELDS = ["email", "password"] as const
export const validateLogin = (v: FormValues) =>
  run(v, {
    email: email(),
    password: [required("Enter your password")],
  })

export const REGISTER_FIELDS = ["first_name", "last_name", "email", "phone", "password"] as const
export const validateRegister = (v: FormValues) =>
  run(v, {
    first_name: [required("Enter your first name"), maxLen(100, "First name must be 100 characters or fewer")],
    last_name: [required("Enter your last name"), maxLen(100, "Last name must be 100 characters or fewer")],
    email: email(),
    phone: optionalPhone,
    password: [
      required("Enter a password"),
      (p) => (p.length < PASSWORD_MIN ? `Password must be at least ${PASSWORD_MIN} characters` : null),
      maxLen(200, "Password must be 200 characters or fewer"),
    ],
  })

export const FORGOT_FIELDS = ["email"] as const
export const validateForgot = (v: FormValues) => run(v, { email: email() })

export const RESET_FIELDS = ["password", "confirm_password"] as const
export const validateReset = (v: FormValues) =>
  run(v, {
    password: [
      required("Enter a new password"),
      (p) => (p.length < PASSWORD_MIN ? `Password must be at least ${PASSWORD_MIN} characters` : null),
      maxLen(200, "Password must be 200 characters or fewer"),
    ],
    confirm_password: [
      required("Enter the new password again"),
      (c, all) => (c !== all.password ? "The passwords do not match" : null),
    ],
  })

export const PROFILE_FIELDS = ["first_name", "last_name", "phone"] as const
export const validateProfile = (v: FormValues) =>
  run(v, {
    first_name: [required("Enter your first name"), maxLen(100, "First name must be 100 characters or fewer")],
    last_name: [required("Enter your last name"), maxLen(100, "Last name must be 100 characters or fewer")],
    phone: optionalPhone,
  })

export const ADDRESS_FIELDS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "postal_code",
  "phone",
  "is_default_shipping",
] as const
export const validateAddress = (v: FormValues) =>
  run(v, {
    first_name: [required("Enter a first name"), maxLen(100, "First name must be 100 characters or fewer")],
    last_name: [required("Enter a last name"), maxLen(100, "Last name must be 100 characters or fewer")],
    company: [maxLen(200, "Company must be 200 characters or fewer")],
    address_1: [required("Enter the first line of the address"), maxLen(200, "Address line 1 must be 200 characters or fewer")],
    address_2: [maxLen(200, "Address line 2 must be 200 characters or fewer")],
    city: [required("Enter a town or city"), maxLen(100, "Town or city must be 100 characters or fewer")],
    postal_code: [required("Enter a postcode"), when(isUkPostcode, "Enter a full UK postcode, like SE16 3TU")],
    phone: optionalPhone,
  })

// ---------------------------------------------------------------------------
// Trade (docs/contracts/trade.md)

export const BUSINESS_TYPES = [
  { value: "sole_trader", label: "Sole trader" },
  { value: "partnership", label: "Partnership" },
  { value: "limited_company", label: "Limited company" },
  { value: "other", label: "Other (for example a charity or school)" },
] as const
export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"]
const isBusinessType = (v: string): v is BusinessType => BUSINESS_TYPES.some((b) => b.value === v)

export const TRADE_FIELDS = [
  "company_name",
  "business_type",
  "vat_number",
  "companies_house_number",
  "contact_name",
  "contact_phone",
  "contact_email",
] as const

export const validateTradeApplication = (v: FormValues) =>
  run(v, {
    company_name: [
      required("Enter your business name"),
      maxLen(200, "Business name must be 200 characters or fewer"),
    ],
    business_type: [
      required("Select your type of business"),
      when(isBusinessType, "Select your type of business"),
    ],
    vat_number: [when(isVatNumber, "Enter a UK VAT number, like GB123456789, or leave it blank")],
    companies_house_number: [
      when(isCompaniesHouseNumber, "Enter an 8-character Companies House number, like 01234567 or SC123456, or leave it blank"),
    ],
    contact_name: [required("Enter a contact name"), maxLen(200, "Contact name must be 200 characters or fewer")],
    contact_phone: phone("contact phone number"),
    contact_email: email("contact email address"),
  })

/** The POST /store/trade-applications body (unknown keys are rejected by the API) */
export function toTradeApplicationBody(v: FormValues) {
  return {
    company_name: v.company_name,
    vat_number: v.vat_number ? normaliseId(v.vat_number) : null,
    companies_house_number: v.companies_house_number ? normaliseId(v.companies_house_number) : null,
    business_type: v.business_type as BusinessType,
    contact: { name: v.contact_name, phone: v.contact_phone, email: v.contact_email },
  }
}

// ---------------------------------------------------------------------------
// Repairs (docs/contracts/repairs.md)

export const REPAIR_FIELDS = [
  "name",
  "phone",
  "email",
  "device",
  "device_id",
  "fault",
  "preferred_day",
  "preferred_time",
  "consent",
] as const

export const PREFERRED_TIMES = [
  { value: "any", label: "Any time" },
  { value: "morning", label: "Morning (before 12pm)" },
  { value: "afternoon", label: "Afternoon (12pm to 5pm)" },
  { value: "evening", label: "Evening (after 5pm)" },
] as const

const DEVICE_ID = /^dev_[A-Za-z0-9]+$/
/** YYYY-MM-DD from <input type="date"> */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Today in London as YYYY-MM-DD (the shop's calendar, not the server's) */
export function londonToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now)
}

export const validateRepairBooking = (v: FormValues, now = new Date()) =>
  run(v, {
    name: [required("Enter your name"), maxLen(200, "Name must be 200 characters or fewer")],
    phone: phone(),
    email: email(),
    device: [required("Enter your device, like iPhone 13 mini"), maxLen(200, "Device must be 200 characters or fewer")],
    device_id: [when((id) => DEVICE_ID.test(id), "Choose your device again from the list")],
    fault: [
      required("Tell us what is wrong with your device"),
      maxLen(2000, "Description must be 2000 characters or fewer"),
    ],
    preferred_day: [
      when((d) => ISO_DAY.test(d) && !Number.isNaN(Date.parse(d)), "Enter a real date, or leave it blank"),
      (d) => (d && ISO_DAY.test(d) && d < londonToday(now) ? "Choose today or a date in the future" : null),
    ],
    preferred_time: [when((t) => PREFERRED_TIMES.some((p) => p.value === t), "Select a time of day")],
    consent: [(c) => (c === "yes" ? null : "Confirm we can use your details to contact you about this repair")],
  })

/** "2026-10-04" -> "Sat 4 Oct" (no timezone drift: the date is a calendar day) */
export function formatDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

/**
 * The contract's free-text preferred_time, e.g. "Sat 4 Oct, morning (before 12pm)"
 * or "Any day, any time". Always 1-200 chars.
 */
export function composePreferredTime(day: string, time: string) {
  const t = PREFERRED_TIMES.find((p) => p.value === time) ?? PREFERRED_TIMES[0]
  const dayText = day && ISO_DAY.test(day) ? formatDay(day) : "Any day"
  const timeText = t.value === "any" ? "any time" : t.label.charAt(0).toLowerCase() + t.label.slice(1)
  return `${dayText}, ${timeText}`
}

export function toRepairBookingBody(v: FormValues, turnstileToken: string) {
  return {
    name: v.name,
    phone: v.phone,
    email: v.email,
    device: v.device,
    device_id: v.device_id || null,
    fault: v.fault,
    preferred_time: composePreferredTime(v.preferred_day, v.preferred_time),
    turnstile_token: turnstileToken,
  }
}
