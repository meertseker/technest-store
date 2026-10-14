import { describe, expect, it } from "vitest"
import { LIMITS, validateContact, validateDelivery, type DeliveryInput } from "./validate"

const base: DeliveryInput = {
  kind: "standard",
  first_name: "Sam",
  last_name: "Smith",
  phone: "",
  address_1: "1 Test Road",
  address_2: "",
  city: "London",
  postal_code: "SE16 3TU",
}

const fields = (errs: { field: string }[]) => errs.map((e) => e.field)

describe("checkout input limits (what Stripe and the backend accept)", () => {
  it("limits are what the inputs advertise", () => {
    expect(LIMITS).toEqual({ email: 254, name: 100, address: 200, phone: 40 })
  })

  it("an email address longer than 254 characters is refused with a reason", () => {
    const long = `${"a".repeat(64)}@${"b".repeat(186)}.com`
    expect(long.length).toBeGreaterThan(254)
    expect(validateContact({ email: long })).toEqual([
      { field: "email", message: "Email address must be 254 characters or fewer" },
    ])
  })

  it("odd shapes that the old check let through are refused", () => {
    for (const bad of ["sam@example", "sam@@example.com", "sam@-example.com", "sam..lee@example.com", ".sam@example.com", "sam@example..com", `${"a".repeat(65)}@example.com`, "sam@example.c"]) {
      expect(validateContact({ email: bad }), bad).toEqual([
        { field: "email", message: "Enter an email address in the correct format, like name@example.com" },
      ])
    }
  })

  it("ordinary addresses still pass", () => {
    for (const ok of ["sam@example.com", "sam.lee+orders@sub.example.co.uk", "o'neil@example.org", "SAM@EXAMPLE.COM", "x@a-b.io"]) {
      expect(validateContact({ email: ok }), ok).toEqual([])
    }
  })

  // The backend validates the basket email again (Medusa's zod email check, zod 4.2): the
  // storefront accepts what it accepts, so a shopper never gets a generic error instead.
  it("matches the backend on internationalised addresses", () => {
    expect(validateContact({ email: "user@xn--bcher-kva.de" })).toEqual([])
    for (const refusedByBackend of ["user@example.xn--p1ai", "user@bücher.de"]) {
      expect(fields(validateContact({ email: refusedByBackend })), refusedByBackend).toEqual(["email"])
    }
  })

  it("names, address lines and phone have maximum lengths, each with its own message", () => {
    const over = (n: number) => "x".repeat(n + 1)
    const errs = validateDelivery({
      ...base,
      first_name: over(100),
      last_name: over(100),
      address_1: over(200),
      address_2: over(200),
      city: over(200),
      phone: `07700 ${"9".repeat(40)}`,
    })
    expect(fields(errs)).toEqual(["first_name", "last_name", "phone", "address_1", "address_2", "city"])
    expect(errs.find((e) => e.field === "first_name")?.message).toBe("First name must be 100 characters or fewer")
    expect(errs.find((e) => e.field === "address_2")?.message).toBe("Address line 2 must be 200 characters or fewer")
    expect(errs.find((e) => e.field === "city")?.message).toBe("Town or city must be 200 characters or fewer")
    expect(errs.find((e) => e.field === "phone")?.message).toBe("Enter a phone number, like 07700 900982")
  })

  it("values exactly at the limit pass", () => {
    expect(
      validateDelivery({ ...base, first_name: "x".repeat(100), last_name: "y".repeat(100), address_1: "z".repeat(200), city: "c".repeat(200) })
    ).toEqual([])
  })

  it("collect still checks the name lengths", () => {
    expect(fields(validateDelivery({ ...base, kind: "collect", first_name: "x".repeat(101) }))).toEqual(["first_name"])
  })
})
