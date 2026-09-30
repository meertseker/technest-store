import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { resolveTurnstileVerifier } from "../../lib/turnstile"

export type VerifyTurnstileInput = {
  turnstile_token: string
  /** The client IP, passed on to Cloudflare siteverify. */
  remote_ip?: string
}

/** Fails the workflow unless Cloudflare Turnstile accepts the token. Nothing to compensate. */
export const verifyTurnstileStep = createStep(
  "verify-turnstile",
  async ({ turnstile_token, remote_ip }: VerifyTurnstileInput, { container }) => {
    const verify = resolveTurnstileVerifier(container)
    if (!(await verify(turnstile_token, remote_ip))) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Turnstile verification failed")
    }
    return new StepResponse(undefined)
  }
)
