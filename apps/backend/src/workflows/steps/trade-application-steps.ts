import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { TRADE_MODULE } from "../../modules/trade"
import TradeModuleService from "../../modules/trade/service"
import { BusinessType, TradeApplicationStatus } from "../../modules/trade/constants"

export type CreateTradeApplicationData = {
  customer_id: string
  company_name: string
  vat_number?: string | null
  companies_house_number?: string | null
  business_type: BusinessType
  contact_name: string
  contact_phone: string
  contact_email: string
}

/** A customer may apply unless they have a pending or approved application. */
export const validateTradeApplicationAllowedStep = createStep(
  "validate-trade-application-allowed",
  async ({ customer_id }: { customer_id: string }, { container }) => {
    const tradeService: TradeModuleService = container.resolve(TRADE_MODULE)
    const open = await tradeService.listTradeApplications(
      { customer_id, status: ["pending", "approved"] },
      { select: ["id", "status"] }
    )
    if (open.some((a) => a.status === "approved")) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Your trade account is already approved"
      )
    }
    if (open.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "You already have a pending trade application"
      )
    }
    return new StepResponse(undefined)
  }
)

export const createTradeApplicationStep = createStep(
  "create-trade-application",
  async (data: CreateTradeApplicationData, { container }) => {
    const tradeService: TradeModuleService = container.resolve(TRADE_MODULE)
    const application = await tradeService.createTradeApplications(data)
    return new StepResponse(application, application.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const tradeService: TradeModuleService = container.resolve(TRADE_MODULE)
    await tradeService.deleteTradeApplications(id)
  }
)

/** Loads an application and fails unless it is still pending. */
export const retrievePendingTradeApplicationStep = createStep(
  "retrieve-pending-trade-application",
  async ({ id }: { id: string }, { container }) => {
    const tradeService: TradeModuleService = container.resolve(TRADE_MODULE)
    const application = await tradeService.retrieveTradeApplication(id, {
      select: ["id", "customer_id", "status"],
    })
    if (application.status !== "pending") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Trade application ${id} is ${application.status}, only pending applications can be reviewed`
      )
    }
    return new StepResponse({ id: application.id, customer_id: application.customer_id })
  }
)

export type UpdateTradeApplicationStatusData = {
  id: string
  status: TradeApplicationStatus
  reason: string | null
}

export const updateTradeApplicationStatusStep = createStep(
  "update-trade-application-status",
  async (data: UpdateTradeApplicationStatusData, { container }) => {
    const tradeService: TradeModuleService = container.resolve(TRADE_MODULE)
    const previous = await tradeService.retrieveTradeApplication(data.id, {
      select: ["id", "status", "reason"],
    })
    const application = await tradeService.updateTradeApplications(data)
    return new StepResponse(application, {
      id: previous.id,
      status: previous.status,
      reason: previous.reason,
    })
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const tradeService: TradeModuleService = container.resolve(TRADE_MODULE)
    await tradeService.updateTradeApplications(previous)
  }
)
