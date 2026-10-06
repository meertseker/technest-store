import { resolveBackendUrl } from "@lib/backend-url"
import { getLocaleHeader } from "@lib/util/get-locale-header"
import Medusa, { FetchArgs, FetchInput } from "@medusajs/js-sdk"

// Literal process.env reads so Next inlines NEXT_PUBLIC_* into the browser bundle
const MEDUSA_BACKEND_URL = resolveBackendUrl(typeof window === "undefined", {
  MEDUSA_BACKEND_URL: process.env.MEDUSA_BACKEND_URL,
  NEXT_PUBLIC_MEDUSA_BACKEND_URL: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL,
})

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})

/**
 * How long a backend call may take before it is abandoned. Without a deadline a
 * backend that accepts the connection but never answers holds every page (the
 * runtime's own limit is minutes). Reads are quick or failed; writes get longer
 * because completing a cart waits for the payment provider.
 */
export const FETCH_TIMEOUT_MS = { read: 8_000, write: 30_000 }

function deadline(method: string | undefined): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") return undefined
  const isRead = !method || /^(get|head)$/i.test(method)
  return AbortSignal.timeout(isRead ? FETCH_TIMEOUT_MS.read : FETCH_TIMEOUT_MS.write)
}

const originalFetch = sdk.client.fetch.bind(sdk.client)

sdk.client.fetch = async <T>(
  input: FetchInput,
  init?: FetchArgs
): Promise<T> => {
  const headers = init?.headers ?? {}
  let localeHeader: Record<string, string | null> | undefined
  try {
    localeHeader = await getLocaleHeader()
    headers["x-medusa-locale"] ??= localeHeader["x-medusa-locale"]
  } catch {}

  const newHeaders = {
    ...localeHeader,
    ...headers,
  }
  init = {
    ...init,
    headers: newHeaders,
    signal: init?.signal ?? deadline(init?.method),
  }
  return originalFetch(input, init)
}
