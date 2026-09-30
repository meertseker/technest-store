import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PHOTO_MODULE } from "../../../../modules/photo"
import PhotoModuleService from "../../../../modules/photo/service"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const photo = req.scope.resolve<PhotoModuleService>(PHOTO_MODULE)
  res.json(await photo.getStatus())
}
