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
  return medusaErrorHandler(error, req, res, next)
}
