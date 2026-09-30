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
import { VerifyTurnstileInput, verifyTurnstileStep } from "./steps/verify-turnstile"

export type CreateRepairBookingWorkflowInput = CreateRepairBookingData & VerifyTurnstileInput

/** Public repair booking: Turnstile check, device check, create, then emit the created event. */
export const createRepairBookingWorkflow = createWorkflow(
  "create-repair-booking",
  function (input: CreateRepairBookingWorkflowInput) {
    const turnstile = transform({ input }, ({ input }) => ({
      turnstile_token: input.turnstile_token,
      remote_ip: input.remote_ip,
    }))
    verifyTurnstileStep(turnstile)
    validateRepairDeviceStep(input)
    const data = transform({ input }, ({ input }): CreateRepairBookingData => {
      const { turnstile_token: _token, remote_ip: _ip, ...booking } = input
      return booking
    })
    const booking = createRepairBookingStep(data)
    const event = transform({ booking }, ({ booking }) => ({
      eventName: REPAIR_EVENTS.CREATED,
      data: { id: booking.id },
    }))
    emitEventStep(event)
    return new WorkflowResponse(booking)
  }
)
