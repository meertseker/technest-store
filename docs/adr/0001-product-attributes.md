# ADR 0001: Where product attributes live

- Status: accepted
- Date: 2026-09-29
- Deciders: E1 (owner), consulted: E3, E4 via TEAM_CHAT

## Context

Accessories need structured attributes: `connector_a`, `connector_b`, `wattage`, `cable_length_m`,
`platform[]`, `is_addon_item`, `safety_marking` (UKCA | CE | none), `warranty_months`, `reorder_level`.
They drive business rules (the add-on basket rule, the publish guard for chargers and power banks,
the 08:00 low-stock digest), storefront filters and search facets, and the owner edits them on a phone.

Options:

1. **Typed `product.metadata`**: no schema, validated by our own code.
2. **Custom module `productAttributes`** with a one-to-one link to Product.

## Decision

**Option 2: a custom `productAttributes` module, linked one-to-one to Product.**

`ProductAttributes` model (one row per product; missing row = all defaults):

| field | type | default |
|---|---|---|
| `connector_a` | text, nullable | null |
| `connector_b` | text, nullable | null |
| `wattage` | float, nullable | null |
| `cable_length_m` | float, nullable | null |
| `platform` | text[] | `[]` (values: `ps5`, `ps4`, `xbox-series`, `xbox-one`, `switch`, `switch-2`, `pc`, `mac`) |
| `is_addon_item` | boolean | false |
| `safety_marking` | enum `UKCA` / `CE` / `none` | `none` |
| `warranty_months` | integer, nullable | null |
| `reorder_level` | integer | 3 |

`reorder_level` is per product and applies to each of its variants (the shop reorders by product).

## Why

- **Types and constraints in the database.** The admin's metadata editor stores strings, so `"false"`
  would count as true in the add-on rule, and nothing would stop `safety_marking: "ukca "`. With enums
  and booleans in the model, the rules we enforce (add-on rule, publish guard) read real types.
- **Readable everywhere with Query**: `product.product_attributes.*` in `query.graph`, including the
  search index document and cart validation, with no JSON parsing.
- **A clear admin surface**: E4 builds one "Product details" widget on the product page against a
  small admin API, which is friendlier on a phone than the raw metadata editor.
- Cost: one extra table and link, plus a workflow step to upsert attributes. That's acceptable.

## Consequences

- Admin API (E4): `GET /admin/products/:id/attributes` and `POST /admin/products/:id/attributes`
  (partial upsert). Contract: `docs/contracts/product-attributes.md` (posted with the module).
- Store API (E3): request `fields=+product_attributes.*` on `/store/products` and
  `/store/devices/:slug/products`. The search index gets `is_addon_item`, `connector_*`, `wattage`,
  `platform` and `safety_marking` as filterable fields.
- The publish guard checks `safety_marking in (UKCA, CE)` for products in `chargers-cables` or `power-banks`
  (children included) when status becomes `published`.
- The seed moves from `metadata` to the module when it lands (dev DBs are reset then).
- `product.metadata` stays free for ad-hoc notes; nothing reads business rules from it.
