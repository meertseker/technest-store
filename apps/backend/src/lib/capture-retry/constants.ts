/** How long after an order was placed the job first looks at it, and the first wait between attempts. */
export const CAPTURE_RETRY_AFTER_MS = 15 * 60 * 1000
/** Attempts by the job before it gives up and tells the shop and the shopper. */
export const CAPTURE_RETRY_MAX_ATTEMPTS = 6

/** Order metadata keys written by the capture-retry job. */
export const CaptureRetryMeta = {
  ATTEMPTS: "capture_retry_attempts",
  LAST_AT: "capture_retry_last_at",
  GAVE_UP_AT: "capture_retry_gave_up_at",
} as const
