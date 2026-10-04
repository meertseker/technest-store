/**
 * Settings production can't run safely without. medusa-config.ts refuses to
 * start when one is missing, instead of booting into a state that looks fine:
 *  - STRIPE_API_KEY / STRIPE_WEBHOOK_SECRET: no card payments, or 3DS and
 *    Klarna orders that stay pending after the shopper has paid.
 *  - REDIS_URL: the server and the worker would each keep their own locks and
 *    event queue in memory, so the browser and the webhook could both
 *    complete the same cart, and events would never reach the worker.
 */
const REQUIRED_IN_PRODUCTION = ["STRIPE_API_KEY", "STRIPE_WEBHOOK_SECRET", "REDIS_URL"] as const

/** Names of the required settings that are missing or blank; empty outside production. */
export function missingProductionEnv(env: Record<string, string | undefined>): string[] {
  if (env.NODE_ENV !== "production") return []
  return REQUIRED_IN_PRODUCTION.filter((name) => !env[name]?.trim())
}
