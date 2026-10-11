// A key the form makes when it opens and sends with every attempt to save, so a
// retry after a lost answer (phone signal in the shop) can be told apart from a
// second product by a server that keeps the key. A server that ignores the key
// loses nothing.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function isIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

/** A fresh random key (UUID v4), from the platform's generator when there is one. */
export function newIdempotencyKey(random: () => string = defaultRandom): string {
  return random()
}

function defaultRandom(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  // Older browsers (no secure context): still unguessable enough to tell two presses apart.
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16))
  hex[12] = "4"
  hex[16] = (8 + Math.floor(Math.random() * 4)).toString(16)
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`
}
