import type { PhotoModel, RemoveBackgroundResult } from "../../modules/photo/providers/types"
import { prepareOriginal, renderProductPhoto, withPhotoLock } from "./render"

export type RemoveBackground = (image: Buffer, options?: { model?: PhotoModel }) => Promise<RemoveBackgroundResult>

/**
 * Cut-out from the provider, then the render. The photo lock covers only the
 * decode and the render, which are memory-heavy and block the event loop; the
 * provider call is network time (up to 90 s), so a second upload does not wait
 * behind it and both stay within the proxy's time limit.
 */
export async function cutOutAndRender(original: Buffer, removeBackground: RemoveBackground, model?: PhotoModel) {
  const prepared = await withPhotoLock(() => prepareOriginal(original))

  let started = Date.now()
  const cutout = await removeBackground(prepared.workerInput, { model })
  const removeMs = Date.now() - started

  started = Date.now()
  const rendered = await withPhotoLock(() => renderProductPhoto(original, cutout.png))
  const renderMs = Date.now() - started
  return { cutout, rendered, removeMs, renderMs }
}
