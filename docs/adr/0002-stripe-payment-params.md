# ADR 0002: Stripe PaymentIntent parameters are server-side only; Klarna gated by basket total

- Status: accepted
- Date: 2026-09-29
- Deciders: E2 (owner). Consulted: E3 (payment step contract to follow)

## Context

We use Medusa's Stripe provider (`pp_stripe_stripe`) with the Payment Element and automatic payment methods. The brief also requires that Klarna is only offered on baskets of £30 or more (`klarna_min_basket`, set in the admin).

Reading the installed `@medusajs/payment-stripe@2.21.2` (`dist/core/stripe-base.js`) showed three things:

1. `initiatePayment` passes the `data` from `POST /store/payment-collections/:id/payment-sessions`, which the **client** sends, into `normalizePaymentIntentParameters`. That copies `capture_method`, `payment_method_types`, `payment_method_configuration`, `confirm`, `off_session`, `payment_method`, `return_url`, `setup_future_usage` and `metadata` onto the PaymentIntent. A shopper could therefore switch to automatic capture, which breaks our Click & Collect "capture on collection" rule, or add Klarna to a £5 basket.
2. `updatePayment` (which runs when the cart total changes) only updates `amount`. So a Klarna decision made when the session was created goes stale as the basket changes.
3. The option that turns on automatic payment methods is `automaticPaymentMethods`. The docs say `automatic_payment_methods`, which the code never reads, so using that name would silently switch automatic payment methods off.

## Options considered

1. **Store-route middleware** that strips `data` from the payment-session request. This fixes point 1, but not point 2: Medusa's cart refresh workflow creates and updates sessions without going through that route.
2. **Two Stripe Payment Method Configurations** (with and without Klarna), chosen per session. This needs Stripe dashboard setup and two env vars, and still needs to be re-evaluated on every amount change.
3. **A thin subclass of the Stripe provider** that ignores client `data` and sets `excluded_payment_method_types` from the server-side amount, on create and on every amount update. The Stripe API accepts `excluded_payment_method_types` on both PaymentIntent create and update (checked against the API reference on 2026-09-29).

## Decision

We chose option 3: `apps/backend/src/modules/stripe` (`TechNestStripeService extends StripeProviderService`).

- `static identifier = "stripe"` and the provider id is `stripe`, so it is still `pp_stripe_stripe`, and the webhook is still `/hooks/payment/stripe_stripe`.
- `initiatePayment`: keeps only `data.session_id` from the input. It adds `excluded_payment_method_types: ["klarna"]` when `amount_pence < klarnaMinBasketPence`. `capture_method` always comes from config (`capture: false` → `manual`).
- `updatePayment`: one Stripe call that sets both the new `amount` and the Klarna exclusion (`""` clears it). It makes no call when the amount is unchanged.
- Config: `automaticPaymentMethods: true`, `capture: false`. The module is registered only when `STRIPE_API_KEY` is set, and production refuses to boot without the key.
- Everything else, including webhook handling, capture, refund and cancel, is Medusa's stock code.

## Consequences

- The storefront can't influence PaymentIntent parameters. The payment step (E2) sends only `provider_id`.
- **Open:** for now the threshold comes from `KLARNA_MIN_BASKET_PENCE` (default 3000). The brief wants it admin-editable through E1's settings module. A payment module provider can't resolve other modules, so once the settings module exists we'll either pass the value through the payment session `context` (set server-side in a workflow hook), or keep the env value and show it read-only in the admin. We'll decide with E1.
- The subclass calls `StripeBase.getStatus`, which is private in the TypeScript types. The unit tests exercise it, so an upstream rename fails CI rather than production.
- When Medusa upgrades, re-read `stripe-base.js` `initiatePayment`/`updatePayment` and re-run `src/modules/stripe/__tests__`.
