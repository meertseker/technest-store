import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type ResolvePhotoFilesInput = {
  processed_file_id: string
  original_file_id: string
  processed_avif_file_id?: string
}

export type ResolvedPhotoFiles = {
  processed: { id: string; url: string }
  original: { id: string; url: string }
  processed_avif: { id: string; url: string } | null
}

/** Looks up the files' URLs and checks they exist. Read-only, so no compensation. */
export const resolvePhotoFilesStep = createStep(
  "resolve-photo-files",
  async (input: ResolvePhotoFilesInput, { container }) => {
    const fileModule = container.resolve(Modules.FILE)

    const resolve = async (id: string) => {
      try {
        const file = await fileModule.retrieveFile(id)
        await fileModule.getAsBuffer(id)
        return { id: file.id, url: file.url }
      } catch {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown file id: ${id}`)
      }
    }

    return new StepResponse<ResolvedPhotoFiles>({
      processed: await resolve(input.processed_file_id),
      original: await resolve(input.original_file_id),
      processed_avif: input.processed_avif_file_id ? await resolve(input.processed_avif_file_id) : null,
    })
  }
)
