import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  ICustomerModuleService,
  IPricingModuleService,
} from "@medusajs/framework/types"
import {
  Modules,
  PriceListStatus,
  PriceListType,
} from "@medusajs/framework/utils"
import {
  findTradeGroupId,
  findTradePriceListId,
  rememberTradeGroupId,
  rememberTradePriceListId,
} from "../../lib/trade-pricing-refs"
import {
  TRADE_GROUP_NAME,
  TRADE_PRICE_LIST_TITLE,
} from "../../modules/trade/constants"

type Created = { id: string; previousRef: string | null } | null

/**
 * Returns the Trade customer group id (by its remembered id, see
 * lib/trade-pricing-refs.ts), creating the group and remembering its id if
 * it is missing. Compensation removes only what this step created.
 */
export const ensureTradeCustomerGroupStep = createStep(
  "ensure-trade-customer-group",
  async (_: void, { container }) => {
    const existing = await findTradeGroupId(container)
    if (existing) {
      return new StepResponse(existing, null as Created)
    }
    const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
    const group = await customerService.createCustomerGroups({ name: TRADE_GROUP_NAME })
    const previousRef = await rememberTradeGroupId(container, group.id)
    return new StepResponse(group.id, { id: group.id, previousRef } as Created)
  },
  async (created, { container }) => {
    if (!created) {
      return
    }
    const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
    await customerService.deleteCustomerGroups(created.id)
    await rememberTradeGroupId(container, created.previousRef)
  }
)

/** Adds a customer to a group; compensation removes them only if this step added them. */
export const addCustomerToGroupStep = createStep(
  "add-customer-to-group",
  async (
    data: { customer_id: string; customer_group_id: string },
    { container }
  ) => {
    const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
    const customer = await customerService.retrieveCustomer(data.customer_id, {
      relations: ["groups"],
    })
    if (customer.groups?.some((g) => g.id === data.customer_group_id)) {
      return new StepResponse(undefined, null)
    }
    await customerService.addCustomerToGroup(data)
    return new StepResponse(undefined, data)
  },
  async (added, { container }) => {
    if (!added) {
      return
    }
    const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
    await customerService.removeCustomerFromGroup(added)
  }
)

/**
 * Takes a customer out of the Trade group (nothing to do when they are not in
 * it, or the group does not exist); compensation puts them back.
 */
export const removeCustomerFromTradeGroupStep = createStep(
  "remove-customer-from-trade-group",
  async ({ customer_id }: { customer_id: string }, { container }) => {
    const groupId = await findTradeGroupId(container)
    if (!groupId) {
      return new StepResponse(undefined, null)
    }
    const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
    const customer = await customerService.retrieveCustomer(customer_id, { relations: ["groups"] })
    if (!customer.groups?.some((g) => g.id === groupId)) {
      return new StepResponse(undefined, null)
    }
    const membership = { customer_id, customer_group_id: groupId }
    await customerService.removeCustomerFromGroup(membership)
    return new StepResponse(undefined, membership)
  },
  async (removed, { container }) => {
    if (!removed) {
      return
    }
    const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
    await customerService.addCustomerToGroup(removed)
  }
)

/**
 * Returns the Trade price list id, creating it (empty, scoped to the group)
 * and remembering its id if it is missing.
 */
export const ensureTradePriceListStep = createStep(
  "ensure-trade-price-list",
  async ({ customer_group_id }: { customer_group_id: string }, { container }) => {
    const existing = await findTradePriceListId(container)
    if (existing) {
      return new StepResponse(existing, null as Created)
    }
    const pricingService: IPricingModuleService = container.resolve(Modules.PRICING)
    const [list] = await pricingService.createPriceLists([
      {
        title: TRADE_PRICE_LIST_TITLE,
        description:
          "Trade account prices by quantity tier (1-9, 10-49, 50+). Amounts are VAT-inclusive in major units; the store shows them ex VAT.",
        type: PriceListType.OVERRIDE,
        status: PriceListStatus.ACTIVE,
        rules: { "customer.groups.id": [customer_group_id] },
      },
    ])
    const previousRef = await rememberTradePriceListId(container, list.id)
    return new StepResponse(list.id, { id: list.id, previousRef } as Created)
  },
  async (created, { container }) => {
    if (!created) {
      return
    }
    const pricingService: IPricingModuleService = container.resolve(Modules.PRICING)
    await pricingService.deletePriceLists([created.id])
    await rememberTradePriceListId(container, created.previousRef)
  }
)
