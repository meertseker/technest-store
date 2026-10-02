import { DisabledProvider } from "./providers/disabled"
import { FalProvider } from "./providers/fal"
import { RembgHttpProvider } from "./providers/rembg-http"
import {
  BackgroundRemovalProvider,
  PHOTO_MODELS,
  PhotoModel,
  RemoveBackgroundResult,
} from "./providers/types"

export type PhotoModuleOptions = {
  /** FAL_KEY: background removal on fal.ai (production). Unset with no worker URL: processing is disabled. */
  falKey?: string
  /** PHOTO_WORKER_URL: our own photo-worker (local use and tests). When set, it is used instead of fal. */
  workerUrl?: string
  /** PHOTO_MODEL, photo-worker only. Unset or empty: birefnet-general. isnet-general-use is the lighter fallback. */
  defaultModel?: PhotoModel | string
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
    const falKey = options.falKey?.trim()
    return falKey ? new FalProvider({ apiKey: falKey, timeoutMs: options.timeoutMs }) : new DisabledProvider()
  }
  const model = options.defaultModel?.trim() || undefined
  if (model && !PHOTO_MODELS.includes(model as PhotoModel)) {
    // A bad setting switches photos off (with the reason) instead of stopping the backend.
    return new DisabledProvider(
      `Photo processing is switched off: PHOTO_MODEL "${model}" is not allowed (use ${PHOTO_MODELS.join(" or ")}).`
    )
  }
  return new RembgHttpProvider({
    url,
    defaultModel: model as PhotoModel | undefined,
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
