import { DisabledProvider } from "./providers/disabled"
import { RembgHttpProvider } from "./providers/rembg-http"
import {
  BackgroundRemovalProvider,
  PhotoModel,
  RemoveBackgroundResult,
} from "./providers/types"

export type PhotoModuleOptions = {
  /** photo-worker base URL. Unset or empty: processing is disabled, the rest of the app works. */
  workerUrl?: string
  defaultModel?: PhotoModel
  timeoutMs?: number
}

export type PhotoStatus = {
  enabled: boolean
  reason: string | null
  provider: string
  default_model: PhotoModel | null
}

export function createProvider(options: PhotoModuleOptions = {}): BackgroundRemovalProvider {
  const url = options.workerUrl?.trim()
  if (!url) {
    return new DisabledProvider()
  }
  return new RembgHttpProvider({
    url,
    defaultModel: options.defaultModel,
    timeoutMs: options.timeoutMs,
  })
}

/** No data models: the module only owns the background-removal provider. */
export default class PhotoModuleService {
  protected readonly provider_: BackgroundRemovalProvider

  constructor(_container: Record<string, unknown>, options: PhotoModuleOptions = {}) {
    this.provider_ = createProvider(options)
  }

  async getStatus(): Promise<PhotoStatus> {
    const { enabled, reason } = await this.provider_.status()
    return {
      enabled,
      reason,
      provider: this.provider_.id,
      default_model: this.provider_.defaultModel,
    }
  }

  async removeBackground(
    image: Buffer,
    options?: { model?: PhotoModel }
  ): Promise<RemoveBackgroundResult> {
    return this.provider_.removeBackground(image, options)
  }
}
