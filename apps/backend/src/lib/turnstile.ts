import { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/** Resolves true when Cloudflare accepts the Turnstile token. Never throws. */
export type TurnstileVerifier = (token: string, remoteIp?: string) => Promise<boolean>

/** Container key a test (or alternative implementation) can register a verifier under. */
export const TURNSTILE_VERIFIER_KEY = "turnstileVerifier"

export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

/**
 * The `action` the repair booking widget is rendered with
 * (`turnstile.render(..., { action })`). A token solved by any other widget on
 * the same site key carries a different action and is refused.
 */
export const REPAIR_BOOKING_TURNSTILE_ACTION = "repair-booking"

type Options = {
  secret: string | undefined
  fetchImpl?: typeof fetch
  timeoutMs?: number
  /** When set, the token must have been solved by a widget with this action. */
  expectedAction?: string
  /** When set, the token must have been solved on this host or one of its subdomains. */
  expectedHostname?: string
}

type SiteVerifyResponse = {
  success?: boolean
  action?: string
  hostname?: string
}

/** True for the host itself and its subdomains (www.technest.co.uk for technest.co.uk). */
export function hostnameMatches(actual: string | undefined, expected: string): boolean {
  const host = (actual ?? "").trim().toLowerCase()
  const want = expected.trim().toLowerCase()
  return !!host && !!want && (host === want || host.endsWith(`.${want}`))
}

/** Server-side Turnstile verification. Fails closed: no secret or any error means "not verified". */
export function createTurnstileVerifier({
  secret,
  fetchImpl = fetch,
  timeoutMs = 5000,
  expectedAction,
  expectedHostname,
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
      const result = (await response.json()) as SiteVerifyResponse
      if (result.success !== true) {
        return false
      }
      if (expectedAction && result.action !== expectedAction) {
        return false
      }
      if (expectedHostname && !hostnameMatches(result.hostname, expectedHostname)) {
        return false
      }
      return true
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

/**
 * The host the widget must have been solved on: the storefront's, from
 * STOREFRONT_URL, and only in production. Elsewhere (local work, a staging
 * box on another name, the env unset) the hostname is not checked.
 */
export function expectedTurnstileHostname(env: {
  nodeEnv?: string
  storefrontUrl?: string
}): string | undefined {
  if (env.nodeEnv !== "production" || !env.storefrontUrl) {
    return undefined
  }
  try {
    return new URL(env.storefrontUrl).hostname || undefined
  } catch {
    return undefined
  }
}

let warned = false

/**
 * Picks the verifier for a request:
 * 1. one registered in the container under TURNSTILE_VERIFIER_KEY (tests),
 * 2. Cloudflare siteverify when TURNSTILE_SECRET_KEY is set, checking the
 *    widget action and, in production, the storefront host,
 * 3. without a secret: a bypass in development/test, and fail closed anywhere else
 *    (production without a secret refuses every booking rather than letting bots in).
 */
export function resolveTurnstileVerifier(
  scope: MedusaContainer,
  env: { secret?: string; nodeEnv?: string; storefrontUrl?: string } = {
    secret: process.env.TURNSTILE_SECRET_KEY,
    nodeEnv: process.env.NODE_ENV,
    storefrontUrl: process.env.STOREFRONT_URL,
  }
): TurnstileVerifier {
  if (scope.hasRegistration(TURNSTILE_VERIFIER_KEY)) {
    return scope.resolve<TurnstileVerifier>(TURNSTILE_VERIFIER_KEY)
  }
  if (env.secret) {
    return createTurnstileVerifier({
      secret: env.secret,
      expectedAction: REPAIR_BOOKING_TURNSTILE_ACTION,
      expectedHostname: expectedTurnstileHostname(env),
    })
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
