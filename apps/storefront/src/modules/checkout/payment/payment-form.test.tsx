// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useEffect } from "react"

// --- mocks -----------------------------------------------------------------
const confirmPayment = vi.fn()
const refresh = vi.fn()

vi.mock("@stripe/stripe-js", () => ({ loadStripe: vi.fn(() => Promise.resolve({})) }))
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="elements">{children}</div>,
  PaymentElement: ({ onReady }: { onReady?: () => void }) => {
    useEffect(() => onReady?.(), [onReady])
    return <div data-testid="mock-payment-element" />
  },
  useStripe: () => ({ confirmPayment }),
  useElements: () => ({}),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))
vi.mock("./actions", () => ({ completeOrder: vi.fn(), preparePaymentSession: vi.fn() }))

import { completeOrder, preparePaymentSession } from "./actions"
import { NETWORK_ERROR, ORDER_FAILED } from "./helpers"
import PaymentForm, { type PaymentFormProps } from "./payment-form"

const complete = vi.mocked(completeOrder)
const prepare = vi.mocked(preparePaymentSession)

const base: PaymentFormProps = {
  mode: "stripe",
  stripeKey: "pk_test_123",
  session: { client_secret: "pi_1_secret_2", klarna_available: false, klarna_min_basket_pence: 3000 },
  needsSession: false,
  cartId: "cart_1",
  total_pence: 2347,
  isCollect: false,
  billing: { name: "Sam Tester", email: "sam@example.com" },
}

beforeEach(() => {
  confirmPayment.mockReset()
  refresh.mockReset()
  complete.mockReset()
  prepare.mockReset()
})
afterEach(cleanup)

const placeButton = () => screen.getByRole("button", { name: /Place order and pay £23.47/ })

describe("PaymentForm (Stripe)", () => {
  it("shows the Payment Element, the total on the button, and the Klarna minimum note", async () => {
    render(<PaymentForm {...base} />)
    expect(screen.getByTestId("mock-payment-element")).toBeTruthy()
    expect(screen.getByTestId("klarna-below-minimum").textContent).toContain("Klarna is available on orders over £30")
    await waitFor(() => expect((placeButton() as HTMLButtonElement).disabled).toBe(false))
  })

  it("shows Klarna messaging only when the session allows it", () => {
    render(<PaymentForm {...base} session={{ ...base.session!, klarna_available: true }} />)
    expect(screen.getByTestId("klarna-available").textContent).toContain("Pay in 3")
    expect(screen.queryByTestId("klarna-below-minimum")).toBeNull()
  })

  it("confirms with redirect if_required, then completes the order server-side", async () => {
    confirmPayment.mockResolvedValue({ paymentIntent: { status: "requires_capture" } })
    let finish!: () => void
    complete.mockReturnValue(new Promise((r) => (finish = () => r(undefined as never))))
    render(<PaymentForm {...base} />)
    await waitFor(() => expect((placeButton() as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(placeButton())

    await waitFor(() => expect(screen.getByTestId("payment-status").textContent).toBe("Payment authorised, placing your order…"))
    expect(complete).toHaveBeenCalledTimes(1)
    const arg = confirmPayment.mock.calls[0][0]
    expect(arg.redirect).toBe("if_required")
    expect(arg.confirmParams.return_url).toMatch(/\/api\/payment-return\?cart_id=cart_1$/)
    expect(arg.confirmParams.payment_method_data.billing_details).toEqual({
      name: "Sam Tester",
      email: "sam@example.com",
      phone: undefined,
    })
    // no double submit while placing
    expect((screen.getByTestId("place-order") as HTMLButtonElement).disabled).toBe(true)
    await act(async () => finish())
  })

  it("a decline shows the error summary, focused, and never completes the cart", async () => {
    confirmPayment.mockResolvedValue({
      error: { type: "card_error", code: "card_declined", message: "Your card was declined." },
    })
    render(<PaymentForm {...base} />)
    await waitFor(() => expect((placeButton() as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(placeButton())

    const summary = await screen.findByTestId("error-summary")
    expect(summary.textContent).toContain("There is a problem")
    expect(summary.textContent).toContain("Your card was declined. Try another card or payment method.")
    expect(summary.querySelector("a")?.getAttribute("href")).toBe("#payment-element")
    expect(document.activeElement).toBe(summary)
    expect(complete).not.toHaveBeenCalled()
    expect((placeButton() as HTMLButtonElement).disabled).toBe(false)
  })

  it("a network failure during confirm is reported without charging", async () => {
    confirmPayment.mockRejectedValue(new TypeError("Failed to fetch"))
    render(<PaymentForm {...base} />)
    await waitFor(() => expect((placeButton() as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(placeButton())
    expect((await screen.findByTestId("error-summary")).textContent).toContain(NETWORK_ERROR)
    expect(complete).not.toHaveBeenCalled()
  })

  it("an order failure after authorisation is shown and can be retried", async () => {
    confirmPayment.mockResolvedValue({ paymentIntent: { status: "requires_capture" } })
    complete.mockResolvedValue({ ok: false, message: ORDER_FAILED })
    render(<PaymentForm {...base} />)
    await waitFor(() => expect((placeButton() as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(placeButton())
    expect((await screen.findByTestId("error-summary")).textContent).toContain("couldn't place your order")
    expect((placeButton() as HTMLButtonElement).disabled).toBe(false)
  })

  it("initiates the session when the total changed, then refreshes", async () => {
    prepare.mockResolvedValue({ ok: true })
    render(<PaymentForm {...base} session={null} needsSession />)
    expect(screen.getByTestId("payment-loading").textContent).toContain("Loading secure payment form")
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledWith() // no client data, ever
  })

  it("offers a retry when the session can't be created", async () => {
    prepare.mockResolvedValue({ ok: false, message: "We couldn't load the secure payment form." })
    render(<PaymentForm {...base} session={null} needsSession />)
    const box = await screen.findByTestId("payment-session-error")
    expect(box.textContent).toContain("We couldn't load the secure payment form.")
    prepare.mockResolvedValue({ ok: true })
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(prepare).toHaveBeenCalledTimes(2)
  })

  it("shows a 3DS/redirect failure from /api/payment-return in the error summary", () => {
    render(<PaymentForm {...base} returnError="Your payment wasn't completed. You haven't been charged." />)
    expect(screen.getByTestId("error-summary").textContent).toContain("Your payment wasn't completed")
  })

  it("Click & Collect explains the hold", () => {
    render(<PaymentForm {...base} isCollect />)
    expect(screen.getByTestId("collect-payment-note").textContent).toContain("only take it when you collect")
  })
})

describe("PaymentForm (manual, dev only)", () => {
  it("shows the dev notice and places the order without Stripe", async () => {
    complete.mockReturnValue(new Promise(() => {}))
    render(<PaymentForm {...base} mode="manual" stripeKey={undefined} session={null} />)
    expect(screen.getByTestId("payment-dev-notice").textContent).toContain("Development only")
    expect(screen.queryByTestId("elements")).toBeNull()
    fireEvent.click(placeButton())
    await waitFor(() => expect(screen.getByTestId("payment-status").textContent).toBe("Placing your order…"))
    expect(complete).toHaveBeenCalledTimes(1)
    expect(confirmPayment).not.toHaveBeenCalled()
  })
})
