/** Models the photo-worker may run. Both MIT. rembg's default model is never used. */
export const PHOTO_MODELS = ["birefnet-general", "isnet-general-use"] as const
export type PhotoModel = (typeof PHOTO_MODELS)[number]
export const DEFAULT_PHOTO_MODEL: PhotoModel = "birefnet-general"

export type ProviderStatus = {
  enabled: boolean
  /** Human-readable reason when disabled; null when enabled. */
  reason: string | null
}

export type RemoveBackgroundResult = {
  /** RGBA PNG. Only its alpha channel is used downstream. */
  png: Buffer
  model: PhotoModel
}

/**
 * Anything that can turn a photo into a transparent cut-out. Swap the
 * implementation (another in-house model, a GPU box) without touching the
 * workflow. Implementations must not alter the product: the pipeline only
 * reads their alpha channel.
 */
export interface BackgroundRemovalProvider {
  readonly id: string
  readonly defaultModel: PhotoModel | null
  status(): Promise<ProviderStatus>
  removeBackground(image: Buffer, options?: { model?: PhotoModel }): Promise<RemoveBackgroundResult>
}
