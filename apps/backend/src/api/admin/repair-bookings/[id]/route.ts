import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteRepairBookingWorkflow } from "../../../../workflows/delete-repair-booking"
import { updateRepairBookingWorkflow } from "../../../../workflows/update-repair-booking"
import { retrieveRepairBookingDTO } from "../../../utils/repairs"
import { AdminUpdateRepairBooking } from "../middlewares"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const repair_booking = await retrieveRepairBookingDTO(req.scope, req.params.id)
  res.json({ repair_booking })
}

export async function POST(
  req: MedusaRequest<AdminUpdateRepairBooking>,
  res: MedusaResponse
) {
  await updateRepairBookingWorkflow(req.scope).run({
    input: { id: req.params.id, ...req.validatedBody },
  })
  const repair_booking = await retrieveRepairBookingDTO(req.scope, req.params.id)
  res.json({ repair_booking })
}

/** Deletes a booking (docs/contracts/repairs.md). 404 when unknown. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  await deleteRepairBookingWorkflow(req.scope).run({ input: { id: req.params.id } })
  res.json({ id: req.params.id, object: "repair_booking", deleted: true })
}
