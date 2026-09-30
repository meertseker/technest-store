import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { prepareOriginal, renderProductPhoto } from "../../lib/photo/render"
import { PHOTO_MODULE, PhotoModel } from "../../modules/photo"
import PhotoModuleService from "../../modules/photo/service"
import { StoredPhoto } from "./store-original-photo"

export type CreateProcessedPhotoInput = {
  original: StoredPhoto
  model?: PhotoModel
}

export type ProcessedPhotoFile = StoredPhoto & {
  format: "webp" | "avif"
  width: number
  height: number
}

export type CreateProcessedPhotoOutput = {
  processed: ProcessedPhotoFile
  processed_avif: ProcessedPhotoFile
  model: PhotoModel
  timings_ms: { remove_background: number; render: number }
}

function baseName(id: string) {
  const name = id.split("/").pop() ?? "photo"
  return name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-") || "photo"
}

/**
 * (b) cut-out from the provider, (c) sharp render, (d) save WebP + AVIF as new
 * files (the original is never overwritten). Rejects photos whose shorter side is
 * under 1000px before calling the worker.
 * Compensation deletes the files this step saved.
 */
export const createProcessedPhotoStep = createStep(
  "create-processed-photo",
  async (input: CreateProcessedPhotoInput, { container }) => {
    const fileModule = container.resolve(Modules.FILE)
    const photo = container.resolve<PhotoModuleService>(PHOTO_MODULE)

    const original = await fileModule.getAsBuffer(input.original.id)
    const prepared = await prepareOriginal(original)

    let started = Date.now()
    const cutout = await photo.removeBackground(prepared.workerInput, { model: input.model })
    const removeMs = Date.now() - started

    started = Date.now()
    const rendered = await renderProductPhoto(original, cutout.png)
    const renderMs = Date.now() - started

    const name = `${baseName(input.original.id)}-processed`
    const [webp, avif] = await fileModule.createFiles([
      { filename: `${name}.webp`, mimeType: "image/webp", content: rendered.webp.toString("base64") },
      { filename: `${name}.avif`, mimeType: "image/avif", content: rendered.avif.toString("base64") },
    ])

    const size = { width: rendered.width, height: rendered.height }
    return new StepResponse<CreateProcessedPhotoOutput, string[]>(
      {
        processed: { id: webp.id, url: webp.url, format: "webp", ...size },
        processed_avif: { id: avif.id, url: avif.url, format: "avif", ...size },
        model: cutout.model,
        timings_ms: { remove_background: removeMs, render: renderMs },
      },
      [webp.id, avif.id]
    )
  },
  async (fileIds, { container }) => {
    if (!fileIds?.length) {
      return
    }
    await container.resolve(Modules.FILE).deleteFiles(fileIds)
  }
)
