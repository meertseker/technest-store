/**
 * The toast for a failed CSV import. The import runs synchronously and a big
 * file takes minutes, so a request the browser or the proxy gave up on may
 * still be running on the server: never tell staff "nothing was changed" then.
 */

import { ImportStoppedError, STOPPED_PART_WAY } from "./import-parts"

/** Answers that mean the server was not heard from in time, not that it refused. */
const CUT_OFF_STATUSES = new Set([408, 502, 504, 524])

export type ImportFailureMessage = { title: string; description?: string }

const STILL_RUNNING: ImportFailureMessage = {
  title: "The import may still be running. Check the product list before retrying.",
  description:
    "The server did not answer in time. Imported rows are not added twice if you import the same file again.",
}

export function importFailureMessage(error: unknown): ImportFailureMessage {
  const message = error instanceof Error ? error.message : undefined
  const status = (error as { status?: unknown } | null)?.status
  const isNetworkFailure = error instanceof TypeError || (error instanceof Error && typeof status !== "number")

  const cutOff = typeof status === "number" && CUT_OFF_STATUSES.has(status)
  if (error instanceof ImportStoppedError && (cutOff || status === undefined)) {
    // Earlier parts are written; say which, and that the last one may still be running.
    return {
      title: "The import stopped part-way. Its last part may still be running.",
      description: `${error.message} Check the product list before retrying.`,
    }
  }
  if (isNetworkFailure || cutOff) {
    return STILL_RUNNING
  }
  if (message && message.includes(STOPPED_PART_WAY)) {
    return { title: "The import stopped part-way.", description: message }
  }
  return { title: "The import didn't run. Nothing was changed.", description: message }
}
