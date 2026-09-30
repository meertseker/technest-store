import { sdk } from "./client"

/** Shapes from docs/contracts/photos.md (admin photo pipeline). */
export type StoredFile = { id: string; url: string }
export type ProcessedFile = StoredFile & { format: "webp" | "avif"; width: number; height: number }
export type PhotoStatus = {
  enabled: boolean
  reason: string | null
  provider: string
  default_model: string | null
}
export type ProcessResult = {
  original: StoredFile
  processed: ProcessedFile
  processed_avif: ProcessedFile
  model: string
  timings_ms: { total: number }
}
export type PhotoOriginalRecord = {
  processed_file_id: string
  processed_url: string
  processed_avif_url: string | null
  original_file_id: string
  original_url: string
}
export type QuickAddMetadata = {
  ai_assisted?: boolean
  original_file_id?: string | null
  original_url?: string | null
}

export const photoStatusQuery = {
  queryKey: ["photo-status"],
  queryFn: () => sdk.client.fetch<PhotoStatus>("/admin/photos/status"),
  // Pings the worker: once per screen is enough (contract: don't poll in a loop).
  staleTime: 60_000,
}

/** Uploads a photo untouched with Medusa's upload route; it becomes the kept original. */
export async function uploadOriginal(file: File): Promise<StoredFile> {
  const { files } = await sdk.admin.upload.create({ files: [file] })
  return { id: files[0].id, url: files[0].url }
}

/** Background clean-up; the contract asks for a client timeout of at least 90 s. */
export function processPhoto(fileId: string) {
  return sdk.client.fetch<ProcessResult>("/admin/photos/process", {
    method: "POST",
    body: { file_id: fileId },
    signal: AbortSignal.timeout(120_000),
  })
}

export function approvePhoto(productId: string, result: ProcessResult) {
  return sdk.client.fetch<{ product: { id: string; thumbnail: string | null } }>(
    `/admin/products/${productId}/photos/approve`,
    {
      method: "POST",
      body: {
        processed_file_id: result.processed.id,
        processed_avif_file_id: result.processed_avif.id,
        original_file_id: result.original.id,
      },
    }
  )
}

export const errorMessage = (e: unknown) =>
  e instanceof Error && e.message ? e.message : "Something went wrong. Try again."
