import type { Readable } from "stream"

/** The parts of Medusa's File Module this needs. */
export type StoredFileReader = {
  retrieveFile(id: string): Promise<{ id: string; url: string }>
  getDownloadStream(id: string): Promise<unknown>
}

/**
 * Looks a stored file up and proves the object is really there, without
 * downloading it.
 *
 * `retrieveFile` alone is not enough: on S3/R2 it only signs a URL and never
 * asks the storage. The File Module has no HEAD-style call, so this opens the
 * download stream (S3 answers 404 before any body is sent; a missing local file
 * errors when opened), waits for the first sign of life and closes it. Only the
 * first chunk is transferred, instead of the whole file (up to 25 MB) that
 * `getAsBuffer` reads.
 */
export async function retrieveStoredFile(
  files: StoredFileReader,
  id: string,
  { timeoutMs = PROBE_TIMEOUT_MS }: { timeoutMs?: number } = {}
): Promise<{ id: string; url: string }> {
  const file = await files.retrieveFile(id)
  const stream = await files.getDownloadStream(id)
  await probeAndClose(stream, timeoutMs)
  return file
}

/** A storage that accepted the request but sends nothing for this long counts as failed. */
export const PROBE_TIMEOUT_MS = 15_000

async function probeAndClose(stream: unknown, timeoutMs: number): Promise<void> {
  const node = stream as Readable | null
  if (!node || typeof node.once !== "function") {
    // A web stream (other runtimes): opening it already got an answer.
    const web = stream as { cancel?: () => Promise<void> } | null
    await web?.cancel?.().catch(() => undefined)
    return
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => done(new Error(`The file storage did not answer within ${Math.round(timeoutMs / 1000)} s`)),
        timeoutMs
      )
      const done = (err?: Error) => {
        clearTimeout(timer)
        node.off("readable", ok)
        node.off("end", ok)
        node.off("error", fail)
        err ? reject(err) : resolve()
      }
      const ok = () => done()
      const fail = (err: Error) => done(err)
      node.once("readable", ok)
      node.once("end", ok)
      node.once("error", fail)
    })
  } finally {
    // An error after closing (e.g. the aborted socket) must not crash the process.
    node.on("error", () => undefined)
    node.destroy()
  }
}
