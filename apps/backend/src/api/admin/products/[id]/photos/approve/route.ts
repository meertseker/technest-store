import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { approveProductPhotoWorkflow } from "../../../../../../workflows/approve-product-photo"
import { AdminApproveProductPhoto } from "../../../../photos/middlewares"

export async function POST(req: AuthenticatedMedusaRequest<AdminApproveProductPhoto>, res: MedusaResponse) {
  const { result } = await approveProductPhotoWorkflow(req.scope).run({
    input: { product_id: req.params.id, ...req.validatedBody },
  })
  res.json({ product: result })
}
