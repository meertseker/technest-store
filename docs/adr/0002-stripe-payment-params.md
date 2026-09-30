# ADR 0002: Stripe PaymentIntent parameters are server-side only; Klarna gated by basket total

- Status: accepted
- Date: 2026-09-29
- Deciders: E2 (owner). Consulted: E3 (payment step contract to follow)

## Context

We use Medusa's Stripe provider (`pp_stripe_stripe`) with the Payment Element and automatic payment methods. The brief also requires that Klarna is only offered on baskets of £30 or more (`klarna_min_basket`, set in the admin).

Reading the installed `@medusajs/payment-stripe@2.21.2` (`dist/core/stripe-base.js`) showed three things:

1. `initiatePayment` passes the `data` from `POST /store/payment-collections/:id/payment-sessions`, which the **client** sends, into `normalizePaymentIntentParameters`. That copies `capture_method`, `payment_method_types`, `payment_method_configuration`, `confirm`, `off_session`, `payment_method`, `return_url`, `setup_future_usage` and `metadata` onto the PaymentIntent. A shopper could therefore switch to automatic capture, which breaks our Click & Collect "capture on collection" rule, or add Klarna to a £5 basket.
2. When the cart total changes, `refreshPaymentCollectionForCartWorkflow` **deletes** the payment sessions (cancelling their intents), and the next payment step creates new ones through `initiatePayment`. Nothing in 2.21.2 core calls `updatePaymentSession`. (An earlier draft of this ADR wrongly said sessions were updated in place; the security review corrected it.)
2b. The payment module stores session data as `{ ...clientData, ...providerData }`. If Stripe returns an API error while the intent is being created, a client-sent `data.id` survives on the session. `authorizePayment` would then fetch that foreign intent, for example the same shopper's intent from another order. The core never checks that the intent belongs to the session.
3. The option that turns on automatic payment methods is `automaticPaymentMethods`. The docs say `automatic_payment_methods`, which the code never reads, so using that name would silently switch automatic payment methods off.

## Options considered

1. **Store-route middleware** that rejects `data` on the payment-session request. It closes the client input path at the source (points 1 and 2b). It doesn't gate Klarna by itself.
2. **Two Stripe Payment Method Configurations** (with and without Klarna), chosen per session. This needs Stripe dashboard setup and two env vars, and still needs to be re-evaluated on every amount change.
3. **A thin subclass of the Stripe provider** that ignores client `data` and sets `excluded_payment_method_types` from the server-side amount, on create and on every amount update. The Stripe API accepts `excluded_payment_method_types` on both PaymentIntent create and update (checked against the API reference on 2026-09-29).

## Decision

We use **options 1 and 3 together**, as defence in depth: `apps/backend/src/modules/stripe` (`TechNestStripeService extends StripeProviderService`), plus the middleware `src/api/store/payment-collections/reject-client-payment-data.ts`, which returns 400 when a non-empty `data` is sent.

- `static identifier = "stripe"` and the provider id is `stripe`, so it is still `pp_stripe_stripe`, and the webhook is still `/hooks/payment/stripe_stripe`.
- `initiatePayment`: keeps only `data.session_id` from the input. It adds `excluded_payment_method_types: ["klarna"]` when `amount_pence < klarnaMinBasketPence`. `capture_method` always comes from config (`capture: false` → `manual`).
- `updatePayment`: one Stripe call that sets both the new `amount` and the Klarna exclusion (`""` clears it), and no call when the amount is unchanged. Stock flows don't call it in 2.21.2 (see point 2), so this is defence in depth for any future caller. Such a caller must pass the **stored** `session.data`.
- `authorizePayment`: after the stock status check, it requires `intent.metadata.session_id === context.idempotency_key`. The payment module sets `idempotency_key` to the session id, and `metadata.session_id` is set server-side when the intent is created. An intent created for this session has this session's amount, because sessions are recreated whenever the total changes. So a foreign or stale intent can't authorise an order.
- Config: `automaticPaymentMethods: true`, `capture: false`. The module is registered only when `STRIPE_API_KEY` is set. Production refuses to boot without `STRIPE_API_KEY` **and** `STRIPE_WEBHOOK_SECRET`; without the secret, 3DS and Klarna orders would hang.
- Region: `src/scripts/enable-stripe.ts` (run with `medusa exec`, idempotent) makes `pp_stripe_stripe` the **only** provider on the GBP region. `pp_system_default` completes orders without taking payment, so it must never be enabled where customers check out.
- Everything else, including webhook handling, capture, refund and cancel, is Medusa's stock code.

## Consequences

- The storefront can't influence PaymentIntent parameters or session data. The payment step (E2) sends only `provider_id`.
- Cart completion marks a session authorised from a **server-side retrieve** of the intent, checked against the session as above, and the signed webhook confirms it. The browser's word is never used.
- **Resolved (2026-09-30):** the Klarna minimum is E1's admin-editable `klarna_min_basket_pence` setting. A payment module provider can't resolve other modules, so `src/api/store/payment-collections/[id]/payment-sessions/route.ts` overrides Medusa's route (same path, core validators still apply) and runs `create-technest-payment-sessions`, which reads the setting with `getTechnestSettings` and passes it to the core `createPaymentSessionsWorkflow` in the session `context` (`technest_klarna_min_basket_pence`, server-side only). The provider falls back to its `klarnaMinBasketPence` option (env `KLARNA_MIN_BASKET_PENCE`) when the context has no valid value. The decision is returned to the storefront as `klarna_available` in the session data (docs/contracts/payments.md).
- The subclass calls `StripeBase.getStatus`, which is private in the TypeScript types. The unit tests exercise it, so an upstream rename fails CI rather than production.
- When Medusa upgrades, re-read `stripe-base.js` `initiatePayment`/`updatePayment` and re-run `src/modules/stripe/__tests__`.
