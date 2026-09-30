import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { REPAIR_EVENTS } from "../modules/repair/constants"
import {
  CreateRepairBookingData,
  createRepairBookingStep,
  validateRepairDeviceStep,
} from "./steps/repair-booking-steps"

export const createRepairBookingWorkflow = createWorkflow(
  "create-repair-booking",
  function (input: CreateRepairBookingData) {
    validateRepairDeviceStep(input)
    const booking = createRepairBookingStep(input)
    const event = transform({ booking }, ({ booking }) => ({
      eventName: REPAIR_EVENTS.CREATED,
      data: { id: booking.id },
    }))
    emitEventStep(event)
    return new WorkflowResponse(booking)
  }
)
