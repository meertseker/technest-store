/**
 * Tech Nest settings (docs/contracts/settings.md, v1).
 * Every value is integer pence (GBP, VAT included); keys end in `_pence`.
 */
export const SETTING_KEYS = [
  "free_delivery_threshold_pence",
  "klarna_min_basket_pence",
] as const

export type TechnestSettingKey = (typeof SETTING_KEYS)[number]
export type TechnestSettings = Record<TechnestSettingKey, number>

/** Upper bound for every value: £1000. */
export const MAX_SETTING_PENCE = 100000

export const DEFAULT_FREE_DELIVERY_THRESHOLD_PENCE = 2000
export const DEFAULT_KLARNA_MIN_BASKET_PENCE = 3000

export function isSettingKey(key: string): key is TechnestSettingKey {
  return (SETTING_KEYS as readonly string[]).includes(key)
}

export function isValidPence(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_SETTING_PENCE
  )
}

/**
 * Defaults used until the owner saves a value. `KLARNA_MIN_BASKET_PENCE` is
 * only a fallback default (the saved setting always wins); invalid env values
 * are ignored.
 */
export function defaultSettings(
  env: NodeJS.ProcessEnv = process.env
): TechnestSettings {
  const envKlarna = env.KLARNA_MIN_BASKET_PENCE?.trim()
  const klarna = envKlarna ? Number(envKlarna) : NaN
  return {
    free_delivery_threshold_pence: DEFAULT_FREE_DELIVERY_THRESHOLD_PENCE,
    klarna_min_basket_pence: isValidPence(klarna)
      ? klarna
      : DEFAULT_KLARNA_MIN_BASKET_PENCE,
  }
}

/** Saved rows over defaults. Unknown keys and invalid values are ignored. */
export function resolveSettings(
  rows: { key: string; value: number }[],
  env: NodeJS.ProcessEnv = process.env
): TechnestSettings {
  const settings = defaultSettings(env)
  for (const row of rows) {
    if (isSettingKey(row.key) && isValidPence(row.value)) {
      settings[row.key] = row.value
    }
  }
  return settings
}

/**
 * Integer pence -> Medusa major units (2000 -> 20). Medusa prices and price
 * rule values are stored as-is in major units (CLAUDE.md), so this is the
 * boundary conversion, not a price "x100".
 */
export function penceToMajorUnits(pence: number): number {
  return pence / 100
}

// ---- Free Standard delivery (conditional shipping price) -------------------

/** Shipping option type code of the delivery option that becomes free. */
export const STANDARD_DELIVERY_CODE = "standard"
/** Cart pricing-context attribute the free price is conditional on (inc. VAT). */
export const ITEM_TOTAL_ATTRIBUTE = "item_total"

export type ExistingPriceRule = {
  attribute: string
  operator: string
  value: string
}

export type ExistingShippingPrice = {
  id: string
  currency_code: string
  amount: number
  price_rules?: ExistingPriceRule[] | null
}

type RuleInput = Record<
  string,
  string | { operator: string; value: number }[]
>

export type ShippingPriceInput = {
  id?: string
  currency_code: string
  amount: number
  rules: RuleInput
}

/** Price rules as the pricing module's `rules` input (eq -> string, others -> numeric list). */
export function rulesToInput(rules: ExistingPriceRule[] | null | undefined): RuleInput {
  const input: RuleInput = {}
  for (const rule of rules ?? []) {
    if (rule.operator === "eq") {
      input[rule.attribute] = rule.value
      continue
    }
    const list = input[rule.attribute]
    const entry = { operator: rule.operator, value: Number(rule.value) }
    input[rule.attribute] = Array.isArray(list) ? [...list, entry] : [entry]
  }
  return input
}

function isConditionalOnItemTotal(price: ExistingShippingPrice) {
  return (price.price_rules ?? []).some((r) => r.attribute === ITEM_TOTAL_ATTRIBUTE)
}

/**
 * New price list for the Standard delivery price set: the normal prices stay
 * (same id and rules), earlier free-delivery prices are dropped, and each
 * normal price gets a £0 twin with the same rules plus
 * `item_total >= threshold` (major units, e.g. 2000 pence -> 20).
 * The £0 twin always has one more rule, so it wins when it matches.
 */
export function buildFreeDeliveryPrices(
  existing: ExistingShippingPrice[],
  thresholdPence: number
): ShippingPriceInput[] {
  const base = existing.filter((p) => !isConditionalOnItemTotal(p))
  const threshold = penceToMajorUnits(thresholdPence)
  return [
    // Rules are passed for the kept prices too: the pricing module de-duplicates
    // price inputs by (currency, amount, rules), so two rule-less entries with
    // the same amount would collapse and the other price would be deleted.
    ...base.map((p) => ({
      id: p.id,
      currency_code: p.currency_code,
      amount: p.amount,
      rules: rulesToInput(p.price_rules),
    })),
    ...base.map((p) => ({
      currency_code: p.currency_code,
      amount: 0,
      rules: {
        ...rulesToInput(p.price_rules),
        [ITEM_TOTAL_ATTRIBUTE]: [{ operator: "gte", value: threshold }],
      },
    })),
  ]
}

/** Input that puts a price set back to a snapshot (compensation). */
export function restoreShippingPrices(
  snapshot: ExistingShippingPrice[]
): ShippingPriceInput[] {
  return snapshot.map((p) =>
    isConditionalOnItemTotal(p)
      ? {
          currency_code: p.currency_code,
          amount: p.amount,
          rules: rulesToInput(p.price_rules),
        }
      : {
          id: p.id,
          currency_code: p.currency_code,
          amount: p.amount,
          rules: rulesToInput(p.price_rules),
        }
  )
}
