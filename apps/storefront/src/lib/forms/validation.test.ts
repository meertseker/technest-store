import { describe, expect, it } from "vitest"
import {
  composePreferredTime,
  formatUkPostcode,
  isCompaniesHouseNumber,
  isPhone,
  isUkPostcode,
  isVatNumber,
  londonToday,
  readForm,
  toRepairBookingBody,
  toTradeApplicationBody,
  validateAddress,
  validateLogin,
  validateRegister,
  validateRepairBooking,
  validateReset,
  validateTradeApplication,
} from "./validation"

const trade = {
  company_name: "Acme Phones Ltd",
  business_type: "limited_company",
  vat_number: "GB 123 4567 89",
  companies_house_number: "sc123456",
  contact_name: "Jane Smith",
  contact_phone: "020 7946 0000",
  contact_email: "jane@acme.test",
}

const NOW = new Date("2026-09-30T10:00:00Z")
const repair = {
  name: "Sam Jones",
  phone: "07700 900123",
  email: "sam@example.com",
  device: "iPhone 13 mini",
  device_id: "dev_01J8ABC",
  fault: "Cracked screen",
  preferred_day: "2026-10-04",
  preferred_time: "morning",
  consent: "yes",
}

describe("readForm", () => {
  it("trims strings and fills missing names with empty strings", () => {
    const fd = new FormData()
    fd.set("email", "  a@b.co ")
    expect(readForm(fd, ["email", "password"])).toEqual({ email: "a@b.co", password: "" })
  })
})

describe("field rules match the backend contracts", () => {
  it("phone: 5-40 chars, digits, spaces and +()- only", () => {
    expect(isPhone("07700 900123")).toBe(true)
    expect(isPhone("+44 (0)20 7946-0000")).toBe(true)
    expect(isPhone("12")).toBe(false)
    expect(isPhone("0770x900123")).toBe(false)
    expect(isPhone("1".repeat(41))).toBe(false)
  })

  it("VAT number: ^(GB)?(9 or 12 digits)$ after removing spaces", () => {
    expect(isVatNumber("gb 123 4567 89")).toBe(true)
    expect(isVatNumber("123456789012")).toBe(true)
    expect(isVatNumber("GB12345678")).toBe(false)
  })

  it("Companies House number: 8 letters/digits", () => {
    expect(isCompaniesHouseNumber("01234567")).toBe(true)
    expect(isCompaniesHouseNumber("sc 123456")).toBe(true)
    expect(isCompaniesHouseNumber("1234567")).toBe(false)
  })

  it("UK postcodes, formatted with one space", () => {
    expect(isUkPostcode("se163tu")).toBe(true)
    expect(isUkPostcode("EC1A 1BB")).toBe(true)
    expect(isUkPostcode("12345")).toBe(false)
    expect(formatUkPostcode(" se163tu ")).toBe("SE16 3TU")
  })
})

describe("accounts", () => {
  it("login needs an email and a password", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({
      email: "Enter your email address",
      password: "Enter your password",
    })
    expect(validateLogin({ email: "nope", password: "x" }).email).toMatch(/correct format/)
    expect(validateLogin({ email: "a@b.co", password: "x" })).toEqual({})
  })

  it("register: names, email, optional phone, 8+ character password", () => {
    const ok = { first_name: "Sam", last_name: "Jones", email: "a@b.co", phone: "", password: "longenough" }
    expect(validateRegister(ok)).toEqual({})
    expect(validateRegister({ ...ok, password: "short" }).password).toBe("Password must be at least 8 characters")
    expect(validateRegister({ ...ok, phone: "abc" }).phone).toMatch(/Enter a phone number/)
  })

  it("reset: passwords must match", () => {
    expect(validateReset({ password: "longenough", confirm_password: "different1" })).toEqual({
      confirm_password: "The passwords do not match",
    })
    expect(validateReset({ password: "longenough", confirm_password: "longenough" })).toEqual({})
  })

  it("address: UK postcode required, optional lines may be blank", () => {
    const ok = {
      first_name: "Sam",
      last_name: "Jones",
      company: "",
      address_1: "1 High St",
      address_2: "",
      city: "London",
      postal_code: "SE16 3TU",
      phone: "",
    }
    expect(validateAddress(ok)).toEqual({})
    expect(validateAddress({ ...ok, postal_code: "90210" }).postal_code).toMatch(/UK postcode/)
    expect(validateAddress({ ...ok, address_1: "" }).address_1).toBe("Enter the first line of the address")
  })
})

describe("trade application", () => {
  it("accepts a complete application and optional ids left blank", () => {
    expect(validateTradeApplication(trade)).toEqual({})
    expect(validateTradeApplication({ ...trade, vat_number: "", companies_house_number: "" })).toEqual({})
  })

  it("names every problem in page order", () => {
    const errors = validateTradeApplication({ ...trade, company_name: "", business_type: "plc", vat_number: "123" })
    expect(Object.keys(errors)).toEqual(["company_name", "business_type", "vat_number"])
  })

  it("builds the contract body: normalised ids, nested contact, blanks as null", () => {
    expect(toTradeApplicationBody(trade)).toEqual({
      company_name: "Acme Phones Ltd",
      vat_number: "GB123456789",
      companies_house_number: "SC123456",
      business_type: "limited_company",
      contact: { name: "Jane Smith", phone: "020 7946 0000", email: "jane@acme.test" },
    })
    const blank = toTradeApplicationBody({ ...trade, vat_number: "", companies_house_number: "" })
    expect(blank.vat_number).toBeNull()
    expect(blank.companies_house_number).toBeNull()
  })
})

describe("repair booking", () => {
  it("accepts a complete booking", () => {
    expect(validateRepairBooking(repair, NOW)).toEqual({})
  })

  it("requires consent and a device, and rejects past dates", () => {
    const e = validateRepairBooking({ ...repair, consent: "", device: "", preferred_day: "2026-09-29" }, NOW)
    expect(e.consent).toMatch(/Confirm we can use your details/)
    expect(e.device).toMatch(/Enter your device/)
    expect(e.preferred_day).toBe("Choose today or a date in the future")
  })

  it("London today is used for the date check (not UTC)", () => {
    // 23:30 UTC on 30 Sep is 00:30 on 1 Oct in London (BST)
    expect(londonToday(new Date("2026-09-30T23:30:00Z"))).toBe("2026-10-01")
  })

  it("only accepts device ids from the picker", () => {
    expect(validateRepairBooking({ ...repair, device_id: "robert'); drop" }, NOW).device_id).toBeTruthy()
    expect(validateRepairBooking({ ...repair, device_id: "" }, NOW)).toEqual({})
  })

  it("composes the free-text preferred_time", () => {
    expect(composePreferredTime("2026-10-04", "morning")).toBe("Sun 4 Oct, morning (before 12pm)")
    expect(composePreferredTime("", "any")).toBe("Any day, any time")
    expect(composePreferredTime("", "evening")).toBe("Any day, evening (after 5pm)")
  })

  it("builds the contract body with only known keys", () => {
    const body = toRepairBookingBody(repair, "tok")
    expect(Object.keys(body).sort()).toEqual(
      ["device", "device_id", "email", "fault", "name", "phone", "preferred_time", "turnstile_token"].sort()
    )
    expect(body.turnstile_token).toBe("tok")
    expect(toRepairBookingBody({ ...repair, device_id: "" }, "t").device_id).toBeNull()
  })
})
