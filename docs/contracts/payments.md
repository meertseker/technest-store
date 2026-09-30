# Contract: payments (Stripe, Klarna, refunds, webhooks)

Owner: E2. Consumers: E3 (checkout payment step, Klarna messaging), E4 (admin: refunds, Stripe
dashboard setup), E1 (settings). Status: **v1 (2026-09-30)**. Changes are posted as `[CONTRACT]`.
Background: `docs/adr/0002-stripe-payment-params.md`. Capture rules: `docs/contracts/click-collect.md`.

Money in this contract: `*_pence` fields are integer pence (GBP, VAT included). Medusa amounts
(`amount`, `total`) are major units as Medusa returns them (`13.47` = £13.47).

## 1. Payment session (storefront payment step)

Provider: `pp_stripe_stripe` (the only provider on the GBP region). Authorise only (`capture: false`).

```ts
// Medusa JS SDK; creates the payment collection if needed, then the session.
const { payment_collection } = await sdk.store.payment.initiatePaymentSession(cart, {
  provider_id: "pp_stripe_stripe",
})
```

- Send **only** `provider_id`. A non-empty `data` gives `400 invalid_data`
  ("Payment session data is set by the server; do not send `data`"); any other body key gives `400`.
- The route is Medusa's path and response (`{ payment_collection }`), overridden server-side
  (`src/api/store/payment-collections/[id]/payment-sessions/route.ts`) to apply the Klarna rule.

The Stripe session (`payment_collection.payment_sessions.find(s => s.provider_id === "pp_stripe_stripe")`)
has in `data`:

```ts
type StripeSessionData = {
  id: string                    // "pi_..." PaymentIntent id
  client_secret: string         // pass to Stripe Elements / Payment Element
  klarna_available: boolean     // true = Klarna is offered in the Payment Element for this amount
  klarna_min_basket_pence: number // the minimum used for this decision, e.g. 3000
  // ...other PaymentIntent fields: treat as opaque, never log
}
```

Rules:

- `klarna_available` is `amount_pence >= klarna_min_basket_pence`, where the amount is the payment
  collection amount (cart total inc. VAT and delivery). The minimum is the admin setting
  `klarna_min_basket_pence` (`docs/contracts/settings.md`); env `KLARNA_MIN_BASKET_PENCE` is only
  the fallback default. When `false`, Klarna is excluded on the PaymentIntent
  (`excluded_payment_method_types: ["klarna"]`), so the Payment Element does not show it.
- Show Klarna messaging in the payment step (e.g. "Pay in 3 with Klarna") **only** when
  `klarna_available` is `true`. Never decide it in the browser from your own totals at this step.
- When the cart total changes (items, delivery option, promo), Medusa deletes the session.
  Call `initiatePaymentSession` again before showing the Payment Element; the flag is re-evaluated.
- Before checkout (product page, basket), use `GET /store/technest-settings` →
  `klarna_min_basket_pence` against the cart total in pence for hints like
  "Klarna available on orders over £30". That is display only; the session flag is authoritative.
- The browser never marks anything paid: cart completion authorises from a server-side
  retrieve of the PaymentIntent, and the signed webhook confirms it.

## 2. Refunds (admin, E4)

Refunds use Medusa's **native** admin flow: the order page's "Refund" action, which calls
`POST /admin/payments/:id/refund` with `{ amount?: number /* major units */, refund_reason_id?, note? }`.
No custom route. Rules (all covered by `integration-tests/http/refunds.spec.ts`):

| Case | Result |
|---|---|
| Captured payment (delivery order after `order.placed`, Click & Collect after "Collected"), partial `amount` | `200`, Stripe refund of that amount |
| Captured payment, no `amount` | `200`, full refund of the payment |
| Several partial refunds | allowed while the total stays within the captured amount |
| Refund above captured minus already refunded | `400 invalid_data` (Medusa allows 1p of rounding; Stripe then refuses anything above the charge) |
| Authorised but **not captured** (e.g. Click & Collect not yet collected) | `400 invalid_data` "You cannot refund more than what is captured on the payment." → **cancel the order instead**, which releases the authorisation |
| Authorisation already released/cancelled | `400 invalid_data` |
| Not logged in as admin | `401` |

Every successful refund emits core `payment.refunded` `{ id }` (payment id), once per refund. The
`refund-issued` email subscriber (`docs/contracts/emails.md` #8) listens to it. Refunds made in
the Stripe dashboard are **not** synced back to Medusa: always refund from the admin.

## 3. Stripe webhook (E4 / lead: Stripe dashboard)

- Endpoint: `https://api.<domain>/hooks/payment/stripe_stripe`, signing secret → `STRIPE_WEBHOOK_SECRET`.
- Events to send: `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`,
  `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.processing`,
  `payment_intent.requires_action`, `payment_intent.partially_funded`.
- Requests without a valid `Stripe-Signature` over the raw body (5 minute tolerance) get
  `400 { "type": "invalid_data", "message": "Invalid webhook signature" }` and are not queued.
  Valid ones get `200` and are processed in the worker (Stripe's library verifies again there).
- Duplicate deliveries are harmless: a captured payment is never captured twice, an authorised
  one is never re-authorised or captured by `amount_capturable_updated`.
- Cloudflare: keep `/hooks/` out of rate limits and bot challenges (DEPLOY.md section 10, 4.3).

## 4. Server-side notes (backend)

- Session context key `technest_klarna_min_basket_pence` is set only by the workflow
  `create-technest-payment-sessions`. Client input can't reach payment session `context`.
- Env: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` (both required in production),
  `KLARNA_MIN_BASKET_PENCE` (fallback only).
