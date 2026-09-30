import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  UpdateRepairBookingData,
  updateRepairBookingStep,
} from "./steps/repair-booking-steps"

export const updateRepairBookingWorkflow = createWorkflow(
  "update-repair-booking",
  function (input: UpdateRepairBookingData) {
    const booking = updateRepairBookingStep(input)
    return new WorkflowResponse(booking)
  }
)
