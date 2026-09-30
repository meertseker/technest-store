import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { quickAddProductWorkflow } from "../../../workflows/quick-add-product"
import { AdminQuickAddCreate } from "./middlewares"

/**
 * POST /admin/quick-add: creates the confirmed product as a DRAFT
 * (docs/contracts/quick-add.md). Publishing is a separate product update.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminQuickAddCreate>,
  res: MedusaResponse
) {
  const { result } = await quickAddProductWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.status(201).json({ product: result })
}
