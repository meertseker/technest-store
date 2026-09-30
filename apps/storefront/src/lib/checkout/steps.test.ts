import { describe, expect, it } from "vitest"
import { firstIncompleteStep, needsStepRedirect, resolveStep } from "./steps"
import { validateContact, validateDelivery, type DeliveryInput } from "./validate"

const empty = {}
const withEmail = { email: "a@b.co" }
const done = { email: "a@b.co", shipping_address: { first_name: "Sam" }, shipping_methods: [{}] }

describe("checkout steps", () => {
  it("renders a bare /checkout in place for our own sections, redirects for E2's", () => {
    expect(needsStepRedirect(undefined, "contact")).toBe(false)
    expect(needsStepRedirect(undefined, "delivery")).toBe(false)
    // payment/review read ?step= in the browser
    expect(needsStepRedirect(undefined, "payment")).toBe(true)
    expect(needsStepRedirect("payment", "payment")).toBe(false)
    // a step that isn't allowed yet, or junk, goes to the right URL
    expect(needsStepRedirect("payment", "delivery")).toBe(true)
    expect(needsStepRedirect("nope", "contact")).toBe(true)
  })

  it("finds the first incomplete step", () => {
    expect(firstIncompleteStep(empty)).toBe("contact")
    expect(firstIncompleteStep(withEmail)).toBe("delivery")
    expect(firstIncompleteStep(done)).toBe("payment")
  })

  it("never jumps past an incomplete step, but allows going back", () => {
    expect(resolveStep("payment", withEmail)).toBe("delivery")
    expect(resolveStep("contact", done)).toBe("contact")
    expect(resolveStep("review", done)).toBe("review")
    expect(resolveStep(undefined, done)).toBe("payment")
    expect(resolveStep("nonsense", empty)).toBe("contact")
  })
})

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

describe("validation", () => {
  it("contact: empty and malformed emails", () => {
    expect(validateContact({ email: " " })[0].message).toBe("Enter your email address")
    expect(validateContact({ email: "sam@" })[0].field).toBe("email")
    expect(validateContact({ email: "sam@example.com" })).toEqual([])
  })

  it("delivery: needs an address and a real postcode", () => {
    expect(validateDelivery(base)).toEqual([])
    const errs = validateDelivery({ ...base, address_1: "", postal_code: "SE16" })
    expect(errs.map((e) => e.field)).toEqual(["address_1", "postal_code"])
  })

  it("collect: only a name, no address", () => {
    expect(
      validateDelivery({ ...base, kind: "collect", address_1: "", city: "", postal_code: "" })
    ).toEqual([])
  })

  it("add-on only baskets can't choose delivery", () => {
    expect(validateDelivery(base, { addonOnly: true })[0].field).toBe("option")
    expect(validateDelivery({ ...base, kind: "collect" }, { addonOnly: true })).toEqual([])
  })

  it("asks for a choice first", () => {
    expect(validateDelivery({ ...base, kind: "" })[0]).toEqual({
      field: "option",
      message: "Choose how you'd like to get your order",
    })
  })
})
