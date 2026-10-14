import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { runOrConflict } from "../../../lib/lock-busy"
import { quickAddProductWorkflow } from "../../../workflows/quick-add-product"
import { AdminQuickAddCreate } from "./middlewares"

/**
 * POST /admin/quick-add: creates the confirmed product as a DRAFT
 * (docs/contracts/quick-add.md). Publishing is a separate product update.
 * 201 for a new product; 200 when the body's idempotency_key already created one.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminQuickAddCreate>,
  res: MedusaResponse
) {
  const { result } = await runOrConflict(
    () => quickAddProductWorkflow(req.scope).run({ input: req.validatedBody }),
    "This product is still being created from your previous submission. Wait a moment and refresh."
  )
  res.status(result.created ? 201 : 200).json({ product: result.product })
}
