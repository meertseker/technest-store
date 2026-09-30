# Contract: emails (owner E2)

Every email goes through the Medusa Notification module (`channel: "email"`, provider `smtp`), so every send is stored as a `notification` row. Templates live in `packages/emails` and are rendered by the `smtp` provider from `notification.template` + `notification.data`.

- **Customer recipient:** `order.email` for order events, `customer.email` for account events.
- **Shop recipient:** env `SHOP_NOTIFY_EMAIL` (default `hello@technest.co.uk`).
- **Sender:** `MAIL_FROM` (`"Tech Nest" <orders@technest.co.uk>`), `MAIL_REPLY_TO` (`hello@technest.co.uk`).
- **Idempotency:** every email is sent at most once per (template, entity id, recipient): the `send-email` workflow checks for an earlier successful notification under a lock before sending (`src/lib/email/send-email-once.ts`). Failed SMTP attempts retry every 60 s, up to 5 times.
- **Workflow inputs are IDs only** (`{ template, recipient: "customer" | "shop", resource_id, resource_type, trigger_type }`): the workflow engine persists inputs, so no addresses, order contents or tokens go in. Each attempt loads fresh data from the id (`src/lib/email/sources.ts`). Password reset is the exception: it bypasses the workflow so the token is never stored.
- **Payloads:** event payloads carry IDs only. Subscribers load the data with `query.graph`. Nobody else needs to send anything beyond the payloads below.

## Event → template → recipient

| # | Event (emitter) | Payload | Template id | To |
|---|---|---|---|---|
| 1 | `order.placed` (core) | `{ id }` | `order-confirmation` | customer |
| 2 | `order.placed` (core) | `{ id }` | `shop-new-order` (Click & Collect flagged in the subject) | shop |
| 3 | `technest.payment.capture_failed` (**new**, E2 capture subscriber) | `{ order_id }` | `payment-failed` | customer (+ copy to shop) |
| 4 | `shipment.created` (core) | `{ id, no_notification }` (fulfillment id) | `order-dispatched` | customer; skipped when `no_notification` |
| 5 | `technest.order.ready_for_collection` (E2 workflow, E4 button) | `{ order_id }` | `ready-for-collection` | customer |
| 6 | `technest.order.collection_reminder` (E2 job, day 3) | `{ order_id }` | `collection-reminder` | customer |
| 7 | `order.canceled` (core; also the day-7 auto-cancel) | `{ id }` | `order-cancelled` | customer |
| 8 | `payment.refunded` (core) | `{ id }` (payment id) | `refund-issued` | customer |
| 9 | `order.return_received` (core) | `{ order_id, return_id }` | `return-received` | customer |
| 10 | `customer.created` (core) | `{ id }` | `welcome` | customer (skipped for guest customers, where `has_account = false`) |
| 11 | `auth.password_reset` (core) | `{ entity_id, actor_type, token }` | `password-reset` | customer or admin user (link chosen by `actor_type`) |
| 12 | `technest.trade_application.created` (E1) | `{ id, customer_id }` | `trade-application-received` → customer; `shop-trade-application` → shop | both |
| 13 | `technest.trade_application.approved` (E1) | `{ id, customer_id }` | `trade-application-approved` | customer |
| 14 | `technest.trade_application.rejected` (E1) | `{ id, customer_id, reason? }` | `trade-application-rejected` | customer |
| 15 | `technest.repair_booking.created` (E1) | `{ id }` | `shop-repair-booking` | shop |
| 16 | `technest.stock.low_digest` (E1 job, 08:00) | `{ variant_ids: string[] }` | `shop-low-stock-digest` | shop; skipped when empty |

**Order metadata the emails read (written by the Click & Collect code, docs/contracts/click-collect.md):** `collection_code` (shown in "Ready for collection"; falls back to the order number), `ready_for_collection_at` (ISO time; "we'll hold it until" = +7 days), and `collection_expired_at` (set by the day-7 job just before it cancels, so the `order-cancelled` email says "not collected").

`technest.order.collected` sends no email at launch (the customer has the goods in hand). It is kept for analytics and the audit trail.

## Content rules
- Shared layout: logo, accent `#D6001C`, and a footer with the legal business name, Unit 2A, Southwark Park Rd., London SE16 3TU, 07775 669000, and a returns link.
- Every email has an HTML part and a plain-text part.
- `order-confirmation`: items, VAT-inclusive totals, delivery or collection choice, the 14-day cancellation right, and the business name and address.
- `ready-for-collection`: collection code, address, today's opening hours (from `profile.json`), map link, "bring your order number".
- `refund-issued`: the amount, and "5–10 working days".
- Logs only ever contain the notification id, template and event, never the address or body.

## Storefront links (agreed with E3, 2026-09-29)
- Order: `/order/{id}/confirmed`; account order: `/account/orders/{id}`
- Customer password reset: `/account/reset-password?token=…&email=…`; staff reset uses Medusa admin's own page
- Trade status: `/account/trade`; trade application form: `/trade/apply`
- The checkout CSP lives in `apps/storefront/checkout-csp.js` (E2), exporting `{ checkoutCsp: string }`

## New env vars (backend)
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_REPLY_TO`, `SHOP_NOTIFY_EMAIL`, `STOREFRONT_URL` (for links), `ADMIN_URL` (admin dashboard base URL incl. `/app`, e.g. `https://admin.technest.co.uk/app`, for staff password reset; falls back to `MEDUSA_BACKEND_URL/app`; production refuses to send a staff reset link without one of them).
Dev: `SMTP_HOST=localhost SMTP_PORT=1025 SMTP_SECURE=false` (Mailpit).
