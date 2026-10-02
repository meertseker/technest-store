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
  /** Per-image timeout, upload and inference together. Default 90 s: the admin gives up at 120 s. */
  timeoutMs?: number
  endpoint?: string
  fetch?: typeof fetch
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/** A 2048 px RGBA PNG stays well under this; anything larger is not our cut-out. */
const MAX_RESULT_BYTES = 60 * 1024 * 1024

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
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: FalProviderOptions) {
    this.apiKey = options.apiKey
    this.endpoint = options.endpoint ?? FAL_BIREFNET_URL
    this.timeoutMs = options.timeoutMs ?? 90_000
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

  private async request(signal: AbortSignal, body: Record<string, unknown>): Promise<unknown> {
    let res: Response
    try {
      res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { Authorization: `Key ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      })
    } catch (e) {
      throw this.networkError(e)
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

  private networkError(e: unknown) {
    const timedOut = ["TimeoutError", "AbortError"].includes((e as Error)?.name)
    return failed(
      timedOut
        ? `The photo service timed out after ${Math.round(this.timeoutMs / 1000)} s`
        : "The photo service is unreachable"
    )
  }
}
