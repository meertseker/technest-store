import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { TRADE_EVENTS } from "../modules/trade/constants"
import {
  createTradeApplicationStep,
  CreateTradeApplicationData,
  validateTradeApplicationAllowedStep,
} from "./steps/trade-application-steps"

export const submitTradeApplicationWorkflow = createWorkflow(
  "submit-trade-application",
  function (input: CreateTradeApplicationData) {
    const check = transform({ input }, ({ input }) => ({ customer_id: input.customer_id }))
    validateTradeApplicationAllowedStep(check)
    const application = createTradeApplicationStep(input)
    const event = transform({ application }, ({ application }) => ({
      eventName: TRADE_EVENTS.CREATED,
      data: { id: application.id, customer_id: application.customer_id },
    }))
    emitEventStep(event)
    return new WorkflowResponse(application)
  }
)
