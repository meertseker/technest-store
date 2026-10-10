import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@lib/data/checkout-actions", () => ({ saveContact: vi.fn(), saveDelivery: vi.fn() }))
import ErrorSummary from "./error-summary"
import StepSection from "./step-section"
import TextField from "./text-field"
import ContactForm from "./contact-form"
import DeliveryForm from "./delivery-form"
import { LIMITS } from "@lib/checkout/validate"

describe("<StepSection>", () => {
  it("done: collapses to a summary with an Edit link", () => {
    const html = renderToStaticMarkup(
      createElement(StepSection, {
        id: "contact",
        number: 1,
        title: "Contact",
        state: "done",
        editHref: "/checkout?step=contact",
        summary: "sam@example.com",
      }, "FORM")
    )
    expect(html).toContain('href="/checkout?step=contact"')
    expect(html).toContain("sam@example.com")
    expect(html).toContain("Step 1 of 3: ")
    expect(html).toContain("(complete)")
    expect(html).not.toContain("FORM")
  })

  it("open: shows the form, no Edit", () => {
    const html = renderToStaticMarkup(
      createElement(StepSection, { id: "delivery", number: 2, title: "Delivery", state: "open" }, "FORM")
    )
    expect(html).toContain("FORM")
    expect(html).not.toContain("Edit")
  })
})

describe("<ErrorSummary>", () => {
  it("is a focusable alert linking to each field", () => {
    const html = renderToStaticMarkup(
      createElement(ErrorSummary, {
        errors: [{ field: "email", message: "Enter your email address" }],
        submission: 1,
        fieldId: (f: string) => `contact-${f}`,
      })
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain("There is a problem")
    expect(html).toContain('href="#contact-email"')
  })

  it("renders nothing without errors", () => {
    expect(
      renderToStaticMarkup(createElement(ErrorSummary, { errors: [], submission: 0, fieldId: (f: string) => f }))
    ).toBe("")
  })
})

describe("<TextField>", () => {
  it("links the error and hint with aria-describedby", () => {
    const html = renderToStaticMarkup(
      createElement(TextField, {
        id: "delivery-postal_code",
        name: "postal_code",
        label: "Postcode",
        hint: "UK only",
        autoComplete: "postal-code",
        error: "Enter your postcode",
      })
    )
    expect(html).toContain('<label for="delivery-postal_code"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="delivery-postal_code-hint delivery-postal_code-error"')
    expect(html).toContain('autoComplete="postal-code"')
    expect(html).toContain("h-12")
  })
})

// The browser stops over-long input before the server has to refuse it
describe("checkout inputs carry the validation limits", () => {
  const attr = (html: string, name: string) =>
    html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? ""

  it("contact: the email field", () => {
    const html = renderToStaticMarkup(createElement(ContactForm, { email: "" }))
    expect(attr(html, "email")).toContain(`maxLength="${LIMITS.email}"`)
  })

  it("delivery: names, address lines and phone", () => {
    const html = renderToStaticMarkup(
      createElement(DeliveryForm, {
        choices: [
          { id: "so_1", kind: "standard", amount: 3.49, amount_pence: 349, available: true, name: "Standard" },
        ] as never,
        addonOnly: false,
        defaults: { option_id: "so_1", first_name: "", last_name: "", phone: "", address_1: "", address_2: "", city: "", postal_code: "" },
        shopAddress: "Unit 2A",
      })
    )
    expect(attr(html, "first_name")).toContain(`maxLength="${LIMITS.name}"`)
    expect(attr(html, "last_name")).toContain(`maxLength="${LIMITS.name}"`)
    expect(attr(html, "address_1")).toContain(`maxLength="${LIMITS.address}"`)
    expect(attr(html, "address_2")).toContain(`maxLength="${LIMITS.address}"`)
    expect(attr(html, "city")).toContain(`maxLength="${LIMITS.address}"`)
    expect(attr(html, "phone")).toContain(`maxLength="${LIMITS.phone}"`)
  })
})
