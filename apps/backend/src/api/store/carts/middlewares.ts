import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { withoutCollectState } from "../../../lib/click-collect"

/**
 * Cart metadata is free-form and copied onto the order when the cart completes,
 * and Click & Collect state lives in order metadata. So the state keys are
 * dropped from whatever a shopper sends; the rest of their metadata is kept.
 * Both bodies are cleaned because Medusa's own validator may run before or
 * after this middleware.
 */
export function dropCollectStateFromCartMetadata(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  for (const body of [req.body, req.validatedBody] as unknown[]) {
    if (body && typeof body === "object" && "metadata" in body) {
      const withMetadata = body as { metadata: unknown }
      withMetadata.metadata = withoutCollectState(withMetadata.metadata)
    }
  }
  next()
}

export const storeCartMiddlewares: MiddlewareRoute[] = [
  { method: ["POST"], matcher: "/store/carts", middlewares: [dropCollectStateFromCartMetadata] },
  { method: ["POST"], matcher: "/store/carts/:id", middlewares: [dropCollectStateFromCartMetadata] },
]
