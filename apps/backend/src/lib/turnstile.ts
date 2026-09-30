import { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

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

/** Dev/test only: accepts any non-empty token without calling Cloudflare. */
export const bypassTurnstileVerifier: TurnstileVerifier = async (token) => !!token

/** The bypass is allowed only when NODE_ENV is explicitly "development" or "test". */
export function isTurnstileBypassAllowed(nodeEnv: string | undefined) {
  return nodeEnv === "development" || nodeEnv === "test"
}

let warned = false

/**
 * Picks the verifier for a request:
 * 1. one registered in the container under TURNSTILE_VERIFIER_KEY (tests),
 * 2. Cloudflare siteverify when TURNSTILE_SECRET_KEY is set,
 * 3. without a secret: a bypass in development/test, and fail closed anywhere else
 *    (production without a secret refuses every booking rather than letting bots in).
 */
export function resolveTurnstileVerifier(
  scope: MedusaContainer,
  env: { secret?: string; nodeEnv?: string } = {
    secret: process.env.TURNSTILE_SECRET_KEY,
    nodeEnv: process.env.NODE_ENV,
  }
): TurnstileVerifier {
  if (scope.hasRegistration(TURNSTILE_VERIFIER_KEY)) {
    return scope.resolve<TurnstileVerifier>(TURNSTILE_VERIFIER_KEY)
  }
  if (env.secret) {
    return createTurnstileVerifier({ secret: env.secret })
  }
  const bypass = isTurnstileBypassAllowed(env.nodeEnv)
  if (!warned && scope.hasRegistration(ContainerRegistrationKeys.LOGGER)) {
    warned = true
    const logger = scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
    if (bypass) {
      logger.warn("TURNSTILE_SECRET_KEY is not set: Turnstile checks are bypassed (dev/test only)")
    } else {
      logger.error("TURNSTILE_SECRET_KEY is not set: every Turnstile check fails")
    }
  }
  return bypass ? bypassTurnstileVerifier : createTurnstileVerifier({ secret: undefined })
}
