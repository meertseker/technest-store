import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type StoreOriginalPhotoInput = {
  /** An existing File Module file (e.g. from POST /admin/uploads). Never deleted by this workflow. */
  file_id?: string
  /** Or a new upload, stored here untouched. */
  upload?: { filename: string; mime_type: string; content_base64: string }
}

export type StoredPhoto = { id: string; url: string }

/**
 * (a) Keeps the original exactly as received. Compensation deletes it only if
 * this step created it.
 */
export const storeOriginalPhotoStep = createStep(
  "store-original-photo",
  async (input: StoreOriginalPhotoInput, { container }) => {
    const fileModule = container.resolve(Modules.FILE)

    if (input.upload && !input.file_id) {
      const [file] = await fileModule.createFiles([
        {
          filename: input.upload.filename,
          mimeType: input.upload.mime_type,
          content: input.upload.content_base64,
        },
      ])
      return new StepResponse<StoredPhoto, string | null>({ id: file.id, url: file.url }, file.id)
    }

    if (input.file_id && !input.upload) {
      let file: { id: string; url: string } | undefined
      try {
        file = await fileModule.retrieveFile(input.file_id)
        // retrieveFile doesn't prove the object exists for every provider; reading it does.
        await fileModule.getAsBuffer(input.file_id)
      } catch {
        file = undefined
      }
      if (!file) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown file_id: ${input.file_id}`)
      }
      return new StepResponse<StoredPhoto, string | null>({ id: file.id, url: file.url }, null)
    }

    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Send either a file or a file_id")
  },
  async (createdFileId, { container }) => {
    if (!createdFileId) {
      return
    }
    await container.resolve(Modules.FILE).deleteFiles([createdFileId])
  }
)
