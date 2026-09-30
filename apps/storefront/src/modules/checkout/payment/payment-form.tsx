"use client"

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe, type PaymentIntentResult, type Stripe, type StripeElementsOptions } from "@stripe/stripe-js"
import { FlaskConical, Info, Loader2, Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import type { FieldError } from "@lib/checkout/validate"
import ErrorSummary from "@modules/checkout/sections/error-summary"
import { completeOrder, preparePaymentSession } from "./actions"
import {
  NETWORK_ERROR,
  SESSION_FAILED,
  classifyConfirmResult,
  formatPenceExact,
  klarnaPaymentNote,
  type StripeSessionView,
} from "./helpers"

export const PAYMENT_FIELD_ID = "payment-element"
export const PLACE_ORDER_ID = "place-order-button"
const fieldId = (f: string) => (f === "payment" ? PAYMENT_FIELD_ID : PLACE_ORDER_ID)

const PLACE_NETWORK_ERROR =
  "We couldn't reach our server to place your order. Check your internet connection and press Place order again."

export type PaymentFormProps = {
  mode: "stripe" | "manual"
  stripeKey?: string
  /** null until the session exists for the cart's current total */
  session: StripeSessionView | null
  needsSession: boolean
  cartId: string
  total_pence: number
  isCollect: boolean
  billing: { name: string; email: string; phone?: string }
  /** message from /api/payment-return (?payment_error=) after a 3DS/Klarna redirect */
  returnError?: string | null
}

type Phase = "idle" | "confirming" | "placing"

// One Stripe.js instance per key for the page's lifetime (loadStripe injects the script once)
const stripeByKey = new Map<string, Promise<Stripe | null>>()
function getStripe(key: string) {
  let p = stripeByKey.get(key)
  if (!p) {
    p = loadStripe(key)
    stripeByKey.set(key, p)
  }
  return p
}

/**
 * Payment step (owner: E2, spec 7.5 step 3). Stripe Payment Element, authorise
 * only (`capture: false` on the backend); the order is completed server-side and
 * the browser never marks anything as paid. Errors use the checkout's error
 * summary (spec 8).
 */
export default function PaymentForm(props: PaymentFormProps) {
  const [errors, setErrors] = useState<FieldError[]>(
    props.returnError ? [{ field: "payment", message: props.returnError }] : []
  )
  const [submission, setSubmission] = useState(props.returnError ? 1 : 0)
  const fail = useCallback((message: string, focus: "payment" | "button" = "button") => {
    setErrors([{ field: focus, message }])
    setSubmission((n) => n + 1)
  }, [])
  const clear = useCallback(() => setErrors([]), [])

  return (
    <div className="flex flex-col gap-6" data-testid="payment-step">
      <ErrorSummary errors={errors} submission={submission} fieldId={fieldId} />
      {props.mode === "manual" ? (
        <ManualCheckout {...props} fail={fail} clear={clear} />
      ) : (
        <StripeStep {...props} fail={fail} clear={clear} />
      )}
    </div>
  )
}

type Handlers = { fail: (message: string, focus?: "payment" | "button") => void; clear: () => void }

// ---------------------------------------------------------------------------
// Stripe

function StripeStep(props: PaymentFormProps & Handlers) {
  const { session, needsSession, stripeKey } = props
  if (!stripeKey) return null
  if (needsSession || !session) return <SessionLoader needsSession={needsSession} />

  const options: StripeElementsOptions = {
    clientSecret: session.client_secret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#111827",
        colorText: "#111827",
        colorTextSecondary: "#4B5563",
        colorDanger: "#B91C1C",
        colorBackground: "#FFFFFF",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSizeBase: "16px",
        borderRadius: "8px",
        spacingUnit: "4px",
      },
      rules: {
        ".Input": { border: "1px solid #6B7280", padding: "12px" },
        ".Input:focus": { outline: "3px solid #1D4ED8", boxShadow: "none" },
        ".Tab:focus, .AccordionItem:focus-visible": { outline: "3px solid #1D4ED8", boxShadow: "none" },
      },
    },
  }

  return (
    // key: a new session (new total) means a new PaymentIntent, so remount Elements
    <Elements key={session.client_secret} stripe={getStripe(stripeKey)} options={options}>
      <StripeCheckout {...props} session={session} />
    </Elements>
  )
}

/** Creates the session (first visit, or after the total changed), then refreshes the page's props */
function SessionLoader({ needsSession }: { needsSession: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const tried = useRef(false)

  const run = useCallback(() => {
    tried.current = true
    setMessage(null)
    startTransition(async () => {
      try {
        const res = await preparePaymentSession()
        if (!res.ok) {
          setMessage(res.message)
          return
        }
        router.refresh()
      } catch {
        setMessage(SESSION_FAILED)
      }
    })
  }, [router])

  useEffect(() => {
    if (needsSession && !tried.current) run()
  }, [needsSession, run])

  const failed = message ?? (tried.current && !pending ? SESSION_FAILED : null)

  if (failed) {
    return (
      <div className="flex flex-col items-start gap-3 rounded border-2 border-destructive p-4" role="alert" data-testid="payment-session-error">
        <p className="font-semibold">{failed}</p>
        <Button variant="secondary" size="md" onClick={run}>
          Try again
        </Button>
      </div>
    )
  }
  return (
    <div aria-busy="true" className="flex flex-col gap-3" data-testid="payment-loading">
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
        Loading secure payment form…
      </p>
      <div aria-hidden className="h-40 rounded border border-border bg-surface-2" />
    </div>
  )
}

function StripeCheckout({
  session,
  cartId,
  total_pence,
  isCollect,
  billing,
  fail,
  clear,
}: PaymentFormProps & Handlers & { session: StripeSessionView }) {
  const stripe = useStripe()
  const elements = useElements()
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const klarna = klarnaPaymentNote(session)

  const place = async () => {
    if (!stripe || !elements || phase !== "idle") return
    clear()
    setPhase("confirming")
    let result: PaymentIntentResult
    try {
      result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // off-site steps (some 3DS, Klarna) come back here; the route completes the cart server-side
          return_url: `${window.location.origin}/api/payment-return?cart_id=${encodeURIComponent(cartId)}`,
          payment_method_data: {
            billing_details: { name: billing.name, email: billing.email, phone: billing.phone || undefined },
          },
        },
        redirect: "if_required",
      })
    } catch {
      setPhase("idle")
      fail(NETWORK_ERROR)
      return
    }
    const outcome = classifyConfirmResult(result)
    if (outcome.kind === "error") {
      setPhase("idle")
      fail(outcome.message, outcome.focus)
      return
    }
    setPhase("placing")
    await submitOrder(setPhase, fail)
  }

  return (
    <>
      {klarna && (
        <p
          className="flex items-start gap-2 rounded border border-border bg-surface p-3"
          data-testid={`klarna-${klarna.kind}`}
        >
          <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
          {klarna.text}
        </p>
      )}

      <div id={PAYMENT_FIELD_ID} tabIndex={-1} className="min-h-40 outline-none" data-testid="stripe-payment-element">
        {loadError ? (
          <p role="alert" className="text-destructive">
            We couldn&apos;t load the payment form. Please refresh the page or call the shop.
          </p>
        ) : (
          <PaymentElement
            options={{
              layout: { type: "accordion", defaultCollapsed: false, radios: true, spacedAccordionItems: false },
              business: { name: "Tech Nest" },
            }}
            onReady={() => setReady(true)}
            onChange={() => clear()}
            onLoadError={() => setLoadError(true)}
          />
        )}
      </div>

      <PlaceOrder
        phase={phase}
        ready={!!stripe && !!elements && ready && !loadError}
        total_pence={total_pence}
        isCollect={isCollect}
        onPlace={place}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Manual provider (dev/CI only: the server resolves this mode, never in production)

function ManualCheckout({ total_pence, isCollect, fail, clear }: PaymentFormProps & Handlers) {
  const [phase, setPhase] = useState<Phase>("idle")
  const place = async () => {
    if (phase !== "idle") return
    clear()
    setPhase("placing")
    await submitOrder(setPhase, fail)
  }
  return (
    <>
      <div
        className="flex gap-3 rounded border-2 border-warning bg-warning-subtle p-4 text-foreground"
        data-testid="payment-dev-notice"
      >
        <FlaskConical aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">Development only: test payment</p>
          <p>
            Stripe isn&apos;t configured here (no <code className="font-mono text-[0.95em]">NEXT_PUBLIC_STRIPE_KEY</code> or no
            Stripe provider on the backend), so this order uses Medusa&apos;s manual test provider. No money is taken.
            Production builds never show this.
          </p>
        </div>
      </div>
      <PlaceOrder
        phase={phase}
        ready
        total_pence={total_pence}
        isCollect={isCollect}
        onPlace={place}
        placingText="Placing your order…"
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Shared

async function submitOrder(setPhase: (p: Phase) => void, fail: Handlers["fail"]) {
  try {
    const res = await completeOrder()
    // on success the action redirects to the confirmation page and returns nothing
    if (res && !res.ok) {
      setPhase("idle")
      fail(res.message)
    }
  } catch {
    setPhase("idle")
    fail(PLACE_NETWORK_ERROR)
  }
}

function PlaceOrder({
  phase,
  ready,
  total_pence,
  isCollect,
  onPlace,
  placingText = "Payment authorised, placing your order…",
}: {
  placingText?: string
  phase: Phase
  ready: boolean
  total_pence: number
  isCollect: boolean
  onPlace: () => void
}) {
  const busy = phase !== "idle"
  const total = formatPenceExact(total_pence)
  const status =
    phase === "confirming"
      ? "Confirming your payment…"
      : phase === "placing"
        ? placingText
        : ""
  return (
    <div className="flex flex-col gap-4">
      {isCollect && (
        <p className="text-muted-foreground" data-testid="collect-payment-note">
          Click &amp; Collect: we hold {total} on your card and only take it when you collect. If you don&apos;t
          collect within 7 days, we cancel the order and release the hold.
        </p>
      )}
      <p className="text-muted-foreground">
        By placing your order you agree to our{" "}
        {/* full page loads out of checkout so its strict CSP isn't carried to other pages */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/legal/terms" className="text-foreground underline underline-offset-4">
          terms of sale
        </a>{" "}
        and{" "}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/legal/returns" className="text-foreground underline underline-offset-4">
          returns policy
        </a>
        .
      </p>
      <Button
        id={PLACE_ORDER_ID}
        type="button"
        size="lg"
        className="w-full md:w-auto"
        onClick={onPlace}
        disabled={busy || !ready}
        aria-busy={busy}
        data-testid="place-order"
      >
        {busy ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Lock aria-hidden />}
        {busy ? "Placing order…" : `Place order and pay ${total}`}
      </Button>
      <p role="status" aria-live="polite" className="min-h-6 font-semibold" data-testid="payment-status">
        {status}
      </p>
    </div>
  )
}
