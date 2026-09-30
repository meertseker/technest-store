import { MedusaError } from "@medusajs/framework/utils"
import {
  BackgroundRemovalProvider,
  DEFAULT_PHOTO_MODEL,
  PHOTO_MODELS,
  PhotoModel,
  ProviderStatus,
  RemoveBackgroundResult,
} from "./types"

export type RembgHttpProviderOptions = {
  /** Base URL of the photo-worker, e.g. http://photo-worker:7000 */
  url: string
  defaultModel?: PhotoModel
  /** Per-image timeout. The worker runs one job at a time, so this includes queueing. */
  timeoutMs?: number
  healthTimeoutMs?: number
  fetch?: typeof fetch
}

export const WORKER_DOWN_REASON = "The photo worker is not responding. Try again in a minute."
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Talks to infra/photo-worker: POST /remove (multipart file + model) -> image/png. */
export class RembgHttpProvider implements BackgroundRemovalProvider {
  readonly id = "rembg-http"
  readonly defaultModel: PhotoModel
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly healthTimeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: RembgHttpProviderOptions) {
    this.baseUrl = options.url.replace(/\/+$/, "")
    this.defaultModel = options.defaultModel ?? DEFAULT_PHOTO_MODEL
    if (!PHOTO_MODELS.includes(this.defaultModel)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unsupported photo model: ${this.defaultModel}`)
    }
    this.timeoutMs = options.timeoutMs ?? 120_000
    this.healthTimeoutMs = options.healthTimeoutMs ?? 2_000
    this.fetchImpl = options.fetch ?? fetch
  }

  async status(): Promise<ProviderStatus> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(this.healthTimeoutMs),
      })
      return res.ok ? { enabled: true, reason: null } : { enabled: false, reason: WORKER_DOWN_REASON }
    } catch {
      return { enabled: false, reason: WORKER_DOWN_REASON }
    }
  }

  async removeBackground(
    image: Buffer,
    options: { model?: PhotoModel } = {}
  ): Promise<RemoveBackgroundResult> {
    // Always send the model explicitly; never rely on any server-side default.
    const model = options.model ?? this.defaultModel
    if (!PHOTO_MODELS.includes(model)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unsupported photo model: ${model}`)
    }
    const form = new FormData()
    form.append("file", new Blob([new Uint8Array(image)], { type: "image/png" }), "photo.png")
    form.append("model", model)

    let res: Response
    try {
      res = await this.fetchImpl(`${this.baseUrl}/remove`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (e) {
      const timedOut = (e as Error)?.name === "TimeoutError"
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        timedOut
          ? `The photo worker timed out after ${Math.round(this.timeoutMs / 1000)} s`
          : "The photo worker is unreachable"
      )
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `The photo worker failed (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
      )
    }
    const png = Buffer.from(await res.arrayBuffer())
    if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "The photo worker did not return a PNG")
    }
    return { png, model }
  }
}
