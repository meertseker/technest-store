import { MedusaError } from "@medusajs/framework/utils"
import sharp from "sharp"
import { BackgroundRemovalProvider, PhotoModel, ProviderStatus, RemoveBackgroundResult } from "./types"

/** fal.ai's hosted BiRefNet (https://fal.ai/models/fal-ai/birefnet/v2). The call waits for the result. */
export const FAL_BIREFNET_URL = "https://fal.run/fal-ai/birefnet/v2"
/** The only model this provider runs: BiRefNet general, the same family as the photo-worker's default. */
export const FAL_PHOTO_MODEL: PhotoModel = "birefnet-general"
const FAL_MODEL_NAME = "General Use (Heavy)"
const FAL_RESOLUTION = "1024x1024"

export type FalProviderOptions = {
  /** FAL_KEY. Sent only to fal.run, never logged or put in an error. */
  apiKey: string
  /**
   * Per-image deadline (PHOTO_TIMEOUT_MS): upload, inference, the one retry and the
   * download together. Default 90 s: the admin request is cut off at about 120 s.
   */
  timeoutMs?: number
  /** Pause before the one retry. */
  retryPauseMs?: number
  endpoint?: string
  fetch?: typeof fetch
}

export const DEFAULT_FAL_TIMEOUT_MS = 90_000
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/** A 2048 px RGBA PNG is a few MB; anything over this is not our cut-out and is not read. */
export const MAX_RESULT_BYTES = 25 * 1024 * 1024
/** The same cap on the base64 text of an inline answer (4 characters per 3 bytes). */
const MAX_RESULT_BASE64_CHARS = Math.ceil((MAX_RESULT_BYTES * 4) / 3)
/** Answers worth one more try: a gateway in front of a cold or busy model. */
const RETRY_STATUSES = new Set([502, 503, 504])

function failed(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

/** fal answers errors as { detail: string } or { detail: [{ msg }] }. Never echo the request back. */
function errorDetail(body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === "string") {
    return detail.slice(0, 200)
  }
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d?.msg === "string" ? d.msg : ""))
      .filter(Boolean)
      .join("; ")
      .slice(0, 200)
  }
  return ""
}

/**
 * Background removal on fal.ai instead of our own photo-worker: nothing heavy runs
 * on the shop's server. Only the photo is sent (as a JPEG copy), and only the alpha
 * channel of the answer is used downstream, so the product's pixels still come from
 * the original. See docs/adr/0004-hosted-background-removal-and-email.md.
 */
export class FalProvider implements BackgroundRemovalProvider {
  readonly id = "fal"
  readonly defaultModel = FAL_PHOTO_MODEL
  readonly timeoutMs: number
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly retryPauseMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: FalProviderOptions) {
    this.apiKey = options.apiKey
    this.endpoint = options.endpoint ?? FAL_BIREFNET_URL
    this.timeoutMs = options.timeoutMs ?? DEFAULT_FAL_TIMEOUT_MS
    this.retryPauseMs = options.retryPauseMs ?? 1_000
    this.fetchImpl = options.fetch ?? fetch
  }

  /** No ping: fal has no free health call, and a bad key shows on the first photo. */
  async status(): Promise<ProviderStatus> {
    return { enabled: true, reason: null }
  }

  async removeBackground(
    image: Buffer,
    options: { model?: PhotoModel } = {}
  ): Promise<RemoveBackgroundResult> {
    const model = options.model ?? this.defaultModel
    if (model !== FAL_PHOTO_MODEL) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `The hosted photo service only runs ${FAL_PHOTO_MODEL} (asked for ${model})`
      )
    }

    // A JPEG copy is several times smaller than the PNG the pipeline hands over; the
    // answer's alpha is resized onto the original anyway.
    let upload: { data: Buffer; info: sharp.OutputInfo }
    try {
      upload = await sharp(image)
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
        .toBuffer({ resolveWithObject: true })
    } catch {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "The photo could not be read")
    }

    // One deadline for the whole photo: the call, its body and (if any) the download.
    const signal = AbortSignal.timeout(this.timeoutMs)
    const result = await this.request(signal, {
      image_url: `data:image/jpeg;base64,${upload.data.toString("base64")}`,
      model: FAL_MODEL_NAME,
      operating_resolution: FAL_RESOLUTION,
      // Only the mask matters to us; skip fal's foreground colour estimation.
      refine_foreground: false,
      output_format: "png",
      // Answer inline as a data URI: one round trip, and fal keeps no copy in its request history.
      sync_mode: true,
    })

    const url = (result as { image?: { url?: unknown } } | null)?.image?.url
    if (typeof url !== "string" || !url) {
      throw failed("The photo service did not return an image")
    }
    const png = await this.readImage(url, signal)
    if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) {
      throw failed("The photo service did not return a PNG")
    }
    await this.assertSameShape(png, upload.info)
    return { png, model }
  }

  /**
   * One POST, and one more after a dropped connection or a 502/503/504 (a cold
   * start behind fal's gateway), as long as the deadline has not passed. A timeout
   * is never retried: the deadline is for the whole photo.
   */
  private async request(signal: AbortSignal, body: Record<string, unknown>): Promise<unknown> {
    const payload = JSON.stringify(body)
    for (let attempt = 1; ; attempt++) {
      const last = attempt === 2
      let res: Response
      try {
        res = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: { Authorization: `Key ${this.apiKey}`, "Content-Type": "application/json" },
          body: payload,
          signal,
        })
      } catch (e) {
        if (last || signal.aborted || this.isTimeout(e)) {
          throw this.networkError(e)
        }
        await this.pause(signal)
        continue
      }
      if (!last && RETRY_STATUSES.has(res.status) && !signal.aborted) {
        await res.body?.cancel().catch(() => {})
        await this.pause(signal)
        continue
      }
      return this.readAnswer(res, signal)
    }
  }

  private async pause(signal: AbortSignal) {
    await new Promise<void>((resolve) => {
      const done = () => {
        signal.removeEventListener("abort", done)
        resolve()
      }
      signal.addEventListener("abort", done, { once: true })
      setTimeout(done, this.retryPauseMs)
    })
    if (signal.aborted) {
      throw this.networkError(signal.reason)
    }
  }

  private async readAnswer(res: Response, signal: AbortSignal): Promise<unknown> {
    // An inline PNG answer is base64 inside JSON; refuse an oversized body before reading it.
    if (Number(res.headers?.get("content-length") ?? 0) > MAX_RESULT_BASE64_CHARS + 4096) {
      throw failed("The photo service returned an image that is too large")
    }
    // A body that is not JSON (an HTML error page) is fine; a body cut off by the deadline is a timeout.
    const json = await res.json().catch((e) => {
      if (signal.aborted) {
        throw this.networkError(e)
      }
      return null
    })
    if (res.status === 401 || res.status === 403) {
      throw failed("The photo service refused our account (check the key and the balance)")
    }
    if (res.status === 429) {
      throw failed("The photo service is busy. Try again in a minute.")
    }
    if (!res.ok) {
      const detail = errorDetail(json)
      throw failed(`The photo service failed (HTTP ${res.status})${detail ? `: ${detail}` : ""}`)
    }
    return json
  }

  /** sync_mode answers with a data URI; fall back to downloading if fal sends a link instead. */
  private async readImage(url: string, signal: AbortSignal): Promise<Buffer> {
    if (url.startsWith("data:")) {
      const comma = url.indexOf(",")
      if (comma < 0 || !url.slice(0, comma).endsWith(";base64")) {
        throw failed("The photo service returned an unreadable image")
      }
      if (url.length - comma - 1 > MAX_RESULT_BASE64_CHARS) {
        throw failed("The photo service returned an image that is too large")
      }
      return Buffer.from(url.slice(comma + 1), "base64")
    }
    if (!url.startsWith("https://")) {
      throw failed("The photo service returned an unreadable image")
    }
    let res: Response
    try {
      // No Authorization header: result links are public and may live on another host.
      res = await this.fetchImpl(url, { signal })
    } catch (e) {
      throw this.networkError(e)
    }
    if (!res.ok) {
      throw failed(`The photo service's image could not be downloaded (HTTP ${res.status})`)
    }
    if (Number(res.headers.get("content-length") ?? 0) > MAX_RESULT_BYTES) {
      throw failed("The photo service returned an image that is too large")
    }
    let data: Buffer
    try {
      data = Buffer.from(await res.arrayBuffer())
    } catch (e) {
      throw this.networkError(e)
    }
    if (data.length > MAX_RESULT_BYTES) {
      throw failed("The photo service returned an image that is too large")
    }
    return data
  }

  /** The mask is stretched onto the original, so it must have the shape of what we sent. */
  private async assertSameShape(png: Buffer, sent: { width: number; height: number }) {
    let meta: sharp.Metadata
    try {
      meta = await sharp(png).metadata()
    } catch {
      throw failed("The photo service returned an unreadable image")
    }
    const sentRatio = sent.width / sent.height
    const gotRatio = (meta.width ?? 0) / (meta.height || 1)
    if (!meta.width || !meta.height || Math.abs(gotRatio - sentRatio) > sentRatio * 0.01) {
      throw failed("The photo service returned an image with a different shape")
    }
  }

  private isTimeout(e: unknown) {
    return ["TimeoutError", "AbortError"].includes((e as Error)?.name)
  }

  private networkError(e: unknown) {
    const timedOut = this.isTimeout(e)
    return failed(
      timedOut
        ? `The photo service timed out after ${Math.round(this.timeoutMs / 1000)} s`
        : "The photo service is unreachable"
    )
  }
}
