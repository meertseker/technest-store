/**
 * Search synonyms, applied at index time.
 *
 * Medusa's search module (2.21, Postgres provider) has no synonym setting, and
 * Postgres synonym dictionaries need files on the database server. So each
 * product document gets a `synonyms` text field: when the product's own text
 * (title, description, categories, tags, option values) contains a term, the
 * words shoppers use for it are added. The shopper's query then matches the
 * field like any other text, with stemming ("leads" ~ "lead") and the
 * storefront's prefix match on the last word.
 *
 * - `group`: interchangeable words; any one found adds all the others.
 * - `when` / `add`: one-way; e.g. a charger is findable as "plug", but a USB
 *   adapter is not findable as "charger".
 *
 * Add entries here (lower case). Changing this list changes the documents, so
 * the next reindex (or product update) picks it up.
 */
export type SynonymRule = { group: string[] } | { when: string[]; add: string[] }

export const SYNONYM_RULES: SynonymRule[] = [
  { when: ["charger"], add: ["plug", "adapter", "power adapter", "charging plug"] },
  { group: ["cable", "lead", "wire", "cord"] },
  { group: ["earphones", "earbuds", "headphones", "in-ear"] },
  { group: ["case", "cover"] },
  { group: ["screen protector", "tempered glass", "screen guard", "glass protector"] },
  { group: ["iphone", "apple"] },
  { when: ["galaxy"], add: ["samsung"] },
  { group: ["power bank", "portable charger", "battery pack"] },
  { group: ["usb-c", "type c", "type-c", "usbc"] },
  { when: ["controller"], add: ["gamepad", "joypad", "pad"] },
]

/** Lower case, punctuation to spaces, so "USB-C" and "usb c" compare equal. */
export function normaliseSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9£]+/g, " ")
    .trim()
}

function containsTerm(normalisedText: string, term: string): boolean {
  const words = normaliseSearchText(term).split(" ").filter(Boolean)
  if (!words.length) return false
  // A plural on the last word still counts ("cases", "earbuds" ~ "earbud").
  const pattern = new RegExp(
    `(?:^| )${words.join(" ")}(?:e?s)?(?= |$)`
  )
  return pattern.test(normalisedText)
}

/**
 * The synonym terms to add for a product: every term a matching rule adds,
 * minus the terms its searchable text already contains, in rule order.
 *
 * @param searchable text the index already searches (title, description,
 *   option values): triggers rules, and terms found in it aren't repeated.
 * @param context text that isn't searched itself (category names, tags):
 *   only triggers rules, so a product in "Earphones" is findable as earphones.
 */
export function synonymsFor(
  searchable: (string | null | undefined)[],
  context: (string | null | undefined)[] = []
): string[] {
  const own = normaliseSearchText(searchable.filter(Boolean).join(" "))
  const all = normaliseSearchText([own, ...context.filter(Boolean)].join(" "))
  if (!all) return []

  const added: string[] = []
  const seen = new Set<string>()
  const push = (term: string) => {
    if (seen.has(term) || containsTerm(own, term)) return
    seen.add(term)
    added.push(term)
  }

  for (const rule of SYNONYM_RULES) {
    const triggers = "group" in rule ? rule.group : rule.when
    const additions = "group" in rule ? rule.group : rule.add
    if (triggers.some((term) => containsTerm(all, term))) {
      additions.forEach(push)
    }
  }
  return added
}
