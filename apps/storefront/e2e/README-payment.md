# Payment step E2E (`e2e/payment.spec.ts`, owner E2)

Two groups of tests. Both place real orders on the backend you point them at, so use a dev backend.

## 1. Manual/test provider (default, runs in dev and CI)

Runs when `NEXT_PUBLIC_STRIPE_KEY` is **empty** and the backend's region offers `pp_system_default`
(a dev backend without `STRIPE_API_KEY`). The payment step then shows a "Development only: test payment"
notice and places orders with Medusa's manual provider. Production builds never take this path
(`resolvePaymentMode` in `src/modules/checkout/payment/helpers.ts`).

```bash
cd apps/storefront            # .env.local: backend URL + publishable key, NEXT_PUBLIC_STRIPE_KEY empty
E2E_PORT=8017 E2E_SCREENS_DIR=../../screens pnpm exec playwright test e2e/payment.spec.ts
```

Covers: Click & Collect order and delivery order end to end, the error summary for a failed off-site
payment (`?payment_error=declined`), the basket Klarna hint, axe at 375 and 1280, screenshots
`payment-{state}-{375|1280}.png`.

## 2. Stripe test mode (skipped unless configured)

Needs Stripe **test** keys only (never live keys):

1. Backend `.env`: `STRIPE_API_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...` (from step 2), then
   `pnpm exec medusa exec ./src/scripts/enable-stripe.ts` so `pp_stripe_stripe` is the region's provider
   (ADR 0002). Restart the backend.
2. Forward webhooks (the signed webhook is what marks payments; without it 3DS/Klarna orders hang):

   ```bash
   stripe login
   stripe listen --forward-to localhost:9001/hooks/payment/stripe_stripe
   # copy the printed whsec_... into STRIPE_WEBHOOK_SECRET and restart the backend
   ```

3. Storefront `.env.local`: `NEXT_PUBLIC_STRIPE_KEY=pk_test_...` (same Stripe account), then:

   ```bash
   E2E_STRIPE=1 E2E_PORT=8017 pnpm exec playwright test e2e/payment.spec.ts -g "Stripe test mode"
   ```

Covers: card `4242 4242 4242 4242` (authorised, order placed; `payment_intent.amount_capturable_updated`
arrives through `stripe listen`), declined card `4000 0000 0000 0002` (error summary, no order) and 3DS
card `4000 0025 0000 3155` (challenge completed in Stripe's frame). Klarna: the step shows
"Pay in 3 ..." only when the session's `klarna_available` is true; below the minimum it shows
"Klarna is available on orders over £X". Test cards: https://docs.stripe.com/testing

The Stripe group has not been run in the cloud container (no Stripe keys there); run it on the dev box
before launch.
