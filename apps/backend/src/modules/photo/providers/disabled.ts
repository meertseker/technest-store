import { MedusaError } from "@medusajs/framework/utils"
import { BackgroundRemovalProvider, ProviderStatus } from "./types"

export const DISABLED_REASON = "Photo processing is switched off (PHOTO_WORKER_URL is not set)."

/** Used when no worker is configured: reports why, and refuses to process. */
export class DisabledProvider implements BackgroundRemovalProvider {
  readonly id = "disabled"
  readonly defaultModel = null

  constructor(private readonly reason: string = DISABLED_REASON) {}

  async status(): Promise<ProviderStatus> {
    return { enabled: false, reason: this.reason }
  }

  async removeBackground(): Promise<never> {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, this.reason)
  }
}
