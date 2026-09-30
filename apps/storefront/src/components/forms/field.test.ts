import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CheckboxField, RadioGroup, TextField, describedBy } from "./field"

describe("form fields", () => {
  it("label above, hint and error linked with aria-describedby", () => {
    const html = renderToStaticMarkup(
      createElement(TextField, { name: "email", label: "Email address", hint: "We send updates here.", error: "Enter your email address" })
    )
    expect(html).toContain('<label for="email"')
    expect(html).toContain('id="email-hint"')
    expect(html).toContain('id="email-error"')
    expect(html).toContain('aria-describedby="email-hint email-error"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain("Error: </span>Enter your email address")
    expect(html).toContain("min-h-12")
    expect(html).toContain("text-base")
  })

  it("no aria-invalid or describedby without an error or hint", () => {
    const html = renderToStaticMarkup(createElement(TextField, { name: "city", label: "Town or city" }))
    expect(html).not.toContain("aria-invalid")
    expect(html).not.toContain("aria-describedby")
    expect(describedBy("x")).toBeUndefined()
  })

  it("marks optional fields in the label", () => {
    const html = renderToStaticMarkup(createElement(TextField, { name: "company", label: "Company", optional: true }))
    expect(html).toContain("(optional)")
  })

  it("radio group: fieldset + legend, first radio has the group id for the error summary", () => {
    const html = renderToStaticMarkup(
      createElement(RadioGroup, {
        name: "business_type",
        label: "Type of business",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
        error: "Select your type of business",
        defaultValue: "b",
      })
    )
    expect(html).toContain("<fieldset")
    expect(html).toContain("<legend")
    expect(html).toContain('id="business_type"')
    expect(html).toContain('id="business_type-b"')
    expect(html).toMatch(/id="business_type-b"[^>]*checked=""/)
  })

  it("checkbox is at least 24px and sits in a 48px label", () => {
    const html = renderToStaticMarkup(createElement(CheckboxField, { name: "consent", label: "I agree" }))
    expect(html).toContain("size-6")
    expect(html).toContain("min-h-12")
  })
})
