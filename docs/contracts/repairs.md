# Contract: repair bookings

Owner: E1. Consumers: E3 (repair booking form), E4 (admin repair queue), E2 (emails, via events).
Status: **draft v1 (2026-09-30)**. Build against the shapes below. Any change is posted as `[CONTRACT]`.

Repairs are not products. A customer sends a request and the shop calls them back.
Store routes need the `x-publishable-api-key` header (use the SDK: `sdk.client.fetch`); no login needed.
Admin routes need an admin session or token.
Errors use Medusa's standard shape: `{ "type": string, "message": string }`.

## Types

```ts
type RepairBookingStatus = "new" | "booked" | "done"

type RepairBooking = {
  id: string                // "rep_01J..."
  name: string
  phone: string
  email: string
  device: string            // free text as typed, e.g. "iPhone 13 mini"
  device_id: string | null  // optional id from the device picker (docs/contracts/devices.md), "dev_..."
  fault: string
  preferred_time: string    // free text, e.g. "Weekday mornings" or "Sat 4 Oct, after 2pm"
  status: RepairBookingStatus
  notes: string | null      // staff-only notes, never returned by store routes
  created_at: string        // ISO 8601
  updated_at: string        // ISO 8601
}
```

## Store API (E3)

### `POST /store/repair-bookings`

Body (unknown keys are rejected with `400`):

```json
{
  "name": "Sam Jones",
  "phone": "07700 900123",
  "email": "sam@example.com",
  "device": "iPhone 13 mini",
  "device_id": "dev_01J...",
  "fault": "Cracked screen, touch still works",
  "preferred_time": "Weekday mornings",
  "turnstile_token": "<token from the Turnstile widget>"
}
```

| Field | Rules |
|---|---|
| `name` | required, 1–200 chars (trimmed) |
| `phone` | required, 5–40 chars, digits, spaces and `+()-` only |
| `email` | required, valid email |
| `device` | required, 1–200 chars |
| `device_id` | optional / `null`; must be an existing device id, else `400` |
| `fault` | required, 1–2000 chars |
| `preferred_time` | required, 1–200 chars |
| `turnstile_token` | required, the Cloudflare Turnstile response token (`cf-turnstile-response`) |

Response `200`: `{ "repair_booking": { "id": "rep_01J...", "status": "new" } }` (no personal data is echoed).

Errors:
- `400 invalid_data` validation failed, or unknown `device_id`.
- `400 not_allowed` "Turnstile verification failed" - the token was missing, invalid, expired or already used.
  Reset the widget and let the user retry.
- `429 too_many_requests` "Too many repair bookings, please try again later" with a `Retry-After` header (seconds).
  Limit: **5 requests per 10 minutes per client IP** (every attempt counts, valid or not).

Emits `technest.repair_booking.created` `{ "id": "rep_..." }`.

Server side the token is verified against `https://challenges.cloudflare.com/turnstile/v0/siteverify` with
`TURNSTILE_SECRET_KEY`. Dev uses Cloudflare's always-pass keys (site key `1x00000000000000000000AA`,
secret `1x0000000000000000000000000000000AA`); with those, any non-empty token such as
`XXXX.DUMMY.TOKEN.XXXX` passes.

## Admin API (E4)

### `GET /admin/repair-bookings`

Query: `status?` (`RepairBookingStatus`, may repeat), `limit?` (1–100, default 20), `offset?` (default 0),
`order?` (`created_at` | `-created_at` | `updated_at` | `-updated_at`; default `-created_at`).

Response `200`:

```json
{ "repair_bookings": [RepairBooking], "count": 7, "limit": 20, "offset": 0 }
```

### `GET /admin/repair-bookings/:id`

Response `200`: `{ "repair_booking": RepairBooking }`. `404` if missing.

### `POST /admin/repair-bookings/:id`

Body: `{ "status"?: RepairBookingStatus, "notes"?: string | null }` (at least one key; notes up to 5000 chars;
`null` clears the notes). Any status may be set (staff can move back, e.g. `booked` -> `new`).
Response `200`: `{ "repair_booking": RepairBooking }`. `404` if missing.

## Events (E2 emails)

| Event | Payload |
|---|---|
| `technest.repair_booking.created` | `{ id: string }` |

Load the booking with `query.graph({ entity: "repair_booking", fields: ["*"], filters: { id } })`.
Never log the booking's personal data (name, phone, email).
