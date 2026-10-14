import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { softDeleteRepairBookingStep } from "./steps/repair-booking-steps"

/**
 * Staff delete a repair booking (a customer's request, or a spam entry). The
 * row is soft-deleted and disappears from every list and lookup; the
 * retention job removes it for good after REPAIR_RETENTION_DAYS.
 */
export const deleteRepairBookingWorkflow = createWorkflow(
  "delete-repair-booking",
  function (input: { id: string }) {
    const deleted = softDeleteRepairBookingStep(input)
    return new WorkflowResponse(deleted)
  }
)
