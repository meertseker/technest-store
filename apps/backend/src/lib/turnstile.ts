import { MedusaContainer } from "@medusajs/framework/types"

/** Resolves true when Cloudflare accepts the Turnstile token. Never throws. */
export type TurnstileVerifier = (token: string, remoteIp?: string) => Promise<boolean>

/** Container key a test (or alternative implementation) can register a verifier under. */
export const TURNSTILE_VERIFIER_KEY = "turnstileVerifier"

export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

type Options = {
  secret: string | undefined
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/** Server-side Turnstile verification. Fails closed: no secret or any error means "not verified". */
export function createTurnstileVerifier({
  secret,
  fetchImpl = fetch,
  timeoutMs = 5000,
}: Options): TurnstileVerifier {
  return async (token, remoteIp) => {
    if (!secret || !token) {
      return false
    }
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp) {
      body.set("remoteip", remoteIp)
    }
    try {
      const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        return false
      }
      const result = (await response.json()) as { success?: boolean }
      return result.success === true
    } catch {
      return false
    }
  }
}

/** The registered verifier if any (tests), else the Cloudflare one using TURNSTILE_SECRET_KEY. */
export function resolveTurnstileVerifier(scope: MedusaContainer): TurnstileVerifier {
  if (scope.hasRegistration(TURNSTILE_VERIFIER_KEY)) {
    return scope.resolve<TurnstileVerifier>(TURNSTILE_VERIFIER_KEY)
  }
  return createTurnstileVerifier({ secret: process.env.TURNSTILE_SECRET_KEY })
}
