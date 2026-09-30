import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { previewProductImportWorkflow } from "../../../../workflows/import-products"
import { AdminProductImport } from "../middlewares"

/** POST /admin/product-import/preview: a dry run. Writes nothing. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminProductImport>,
  res: MedusaResponse
) {
  const { result } = await previewProductImportWorkflow(req.scope).run({
    input: { csv: req.validatedBody.csv },
  })
  res.json({ plan: result })
}
