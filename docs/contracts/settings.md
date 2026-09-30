# Contract: Tech Nest settings

Owner: E1. Consumers: E3 (free-delivery progress bar, Klarna visibility), E2 (Klarna gating),
E4 (admin settings page), C2 (trade/repair may add keys later: ask E1).
Status: **v1 (2026-09-30)**. Build against this now; the routes land on `e1/settings`.

All amounts are **integer pence (GBP, VAT included)**. Field names end in `_pence`.

## Type

```ts
type TechnestSettings = {
  free_delivery_threshold_pence: number   // default 2000 (£20). Basket subtotal (inc. VAT) at or above this => Standard delivery is free
  klarna_min_basket_pence: number         // default 3000 (£30). Klarna is offered only at or above this basket total
}
```

## Store

`GET /store/technest-settings` (publishable key header, no auth)

```json
200 { "settings": { "free_delivery_threshold_pence": 2000, "klarna_min_basket_pence": 3000 } }
```

Always returns every key (defaults when the owner never saved). Safe to cache for 60 s
(the route sends `Cache-Control: public, max-age=60`). Without the publishable key: 400.

## Admin (E4)

`GET /admin/technest-settings` -> same body as the store route.

`POST /admin/technest-settings` (partial update)

```json
{ "free_delivery_threshold_pence": 2500 }
-> 200 { "settings": { "free_delivery_threshold_pence": 2500, "klarna_min_basket_pence": 3000 } }
```

Validation: each value an integer, 0 ..= 100000 (£1000); unknown keys -> 400 `invalid_data`.
An empty body is also 400 `invalid_data`. Not logged in: 401.

Event: every successful save emits `technest.settings.updated` with `{ keys: string[] }` (the keys in the
request). Admin page: Settings -> "Shop settings" (`/app/settings/technest`), amounts typed in pounds.

Side effect: saving `free_delivery_threshold_pence` also updates the Standard delivery shipping option,
so its price is £0 when the basket item total (inc. VAT) is >= the threshold (a Medusa conditional
shipping price on `item_total`). Next-day is never free; Click & Collect is always £0. The storefront
reads the real shipping option prices from Medusa's cart/shipping-option APIs; the setting is only for
the progress bar text ("£X.XX away from free delivery").

## Server side (E2)

Read it in backend code with `getTechnestSettings(container)` from `src/modules/settings/get-settings.ts`
(lands with `e1/settings`), instead of the `KLARNA_MIN_BASKET_PENCE` env. The env stays as a fallback
default only.
