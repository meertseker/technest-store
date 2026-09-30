import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createTechnestPaymentSessionsWorkflow } from "../../../../../workflows/create-technest-payment-sessions"

/**
 * POST /store/payment-collections/:id/payment-sessions
 *
 * Overrides Medusa's route (same path, same validators and query config from
 * the core middlewares) so the Klarna minimum from the settings module reaches
 * the Stripe provider in the session context. Client `data` is refused earlier
 * by `rejectClientPaymentData` and never forwarded. Response is Medusa's:
 * `{ payment_collection }`; the Stripe session's `data.klarna_available`
 * tells the storefront whether Klarna is offered (docs/contracts/payments.md).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<HttpTypes.StoreInitializePaymentSession>,
  res: MedusaResponse<HttpTypes.StorePaymentCollectionResponse>
) {
  const collectionId = req.params.id

  await createTechnestPaymentSessionsWorkflow(req.scope).run({
    input: {
      payment_collection_id: collectionId,
      provider_id: req.validatedBody.provider_id,
      customer_id: req.auth_context?.actor_id,
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [paymentCollection],
  } = await query.graph({
    entity: "payment_collection",
    fields: req.queryConfig.fields,
    filters: { id: collectionId },
  })
  if (!paymentCollection) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Payment collection ${collectionId} not found`)
  }

  res.status(200).json({
    payment_collection: paymentCollection as unknown as HttpTypes.StorePaymentCollection,
  })
}
