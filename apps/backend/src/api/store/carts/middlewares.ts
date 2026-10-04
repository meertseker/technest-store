import {
  authenticate,
  type AuthenticatedMedusaRequest,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
  type MiddlewareRoute,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
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

/**
 * Medusa attaches a cart to the registered customer whose email it carries,
 * whoever is calling, and prices it with that customer's groups. So a guest
 * can't use the email of a customer in a customer group (trade): they'd get
 * the Trade prices. Registered customers without a group can still check out
 * as a guest with their email.
 */
export async function refuseGuestUseOfTradeEmail(
  req: AuthenticatedMedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const email = (req.body as { email?: unknown } | undefined)?.email
  if (typeof email !== "string" || !email.trim() || req.auth_context?.actor_id) {
    return next()
  }
  const typed = email.trim()
  const customers = await req.scope
    .resolve(Modules.CUSTOMER)
    .listCustomers(
      { email: [typed, typed.toLowerCase()], has_account: true },
      { relations: ["groups"], select: ["id"] }
    )
  if (customers.some((customer) => customer.groups?.length)) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "This email belongs to a trade account. Sign in to use it."
    )
  }
  next()
}

const cartBodyGuards = [
  dropCollectStateFromCartMetadata,
  authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true }),
  refuseGuestUseOfTradeEmail,
]

export const storeCartMiddlewares: MiddlewareRoute[] = [
  { method: ["POST"], matcher: "/store/carts", middlewares: cartBodyGuards },
  { method: ["POST"], matcher: "/store/carts/:id", middlewares: cartBodyGuards },
]
