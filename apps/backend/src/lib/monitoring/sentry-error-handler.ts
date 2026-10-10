import { MedusaError } from "@medusajs/framework/utils"
import {
  errorHandler,
  getHttpResponseFromError,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http"

const medusaErrorHandler = errorHandler()

type CaptureFn = (error: unknown) => void

let capture: CaptureFn | null | undefined

function getCapture(): CaptureFn | null {
  if (capture === undefined) {
    capture = null
    if (process.env.SENTRY_DSN) {
      try {
        const Sentry = require("@sentry/node") as typeof import("@sentry/node")
        capture = (error) => Sentry.captureException(error)
      } catch {
        capture = null
      }
    }
  }
  return capture
}

/** Test hook: replace the capture function (null = Sentry off). */
export function setSentryCaptureForTests(fn: CaptureFn | null | undefined) {
  capture = fn
}

/**
 * Medusa's default error handler, plus: report server errors (5xx) to Sentry.
 * 4xx responses (validation, not found, unauthorised) are expected and not reported.
 *
 * A 409 we raise ourselves ("the stock is now 2, not 3", "the order is being
 * updated") keeps its message: Medusa's handler would replace it with its
 * generic idempotency-key sentence, which means nothing to staff.
 */
export function sentryErrorHandler(
  error: unknown,
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const report = getCapture()
  if (report && getHttpResponseFromError(error).statusCode >= 500) {
    report(error)
  }
  // An error thrown inside a workflow step arrives re-created, not as the MedusaError instance.
  const conflict = error as { type?: unknown; message?: unknown } | null
  if (conflict?.type === MedusaError.Types.CONFLICT && typeof conflict.message === "string" && conflict.message) {
    res.status(409).json({ type: "conflict", message: conflict.message })
    return
  }
  return medusaErrorHandler(error, req, res, next)
}
