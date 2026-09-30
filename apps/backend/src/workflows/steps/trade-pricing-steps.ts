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
  TRADE_GROUP_NAME,
  TRADE_PRICE_LIST_TITLE,
} from "../../modules/trade/constants"

/** Returns the "Trade" customer group id, creating the group if it is missing. */
export const ensureTradeCustomerGroupStep = createStep(
  "ensure-trade-customer-group",
  async (_: void, { container }) => {
    const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
    const [existing] = await customerService.listCustomerGroups(
      { name: TRADE_GROUP_NAME },
      { select: ["id"], take: 1 }
    )
    if (existing) {
      return new StepResponse(existing.id, null)
    }
    const group = await customerService.createCustomerGroups({ name: TRADE_GROUP_NAME })
    return new StepResponse(group.id, group.id)
  },
  async (createdId, { container }) => {
    if (!createdId) {
      return
    }
    const customerService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
    await customerService.deleteCustomerGroups(createdId)
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

/** Returns the "Trade" price list id, creating it (empty, scoped to the group) if missing. */
export const ensureTradePriceListStep = createStep(
  "ensure-trade-price-list",
  async ({ customer_group_id }: { customer_group_id: string }, { container }) => {
    const pricingService: IPricingModuleService = container.resolve(Modules.PRICING)
    const lists = await pricingService.listPriceLists({}, { select: ["id", "title"] })
    const existing = lists.find((l) => l.title === TRADE_PRICE_LIST_TITLE)
    if (existing) {
      return new StepResponse(existing.id, null)
    }
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
    return new StepResponse(list.id, list.id)
  },
  async (createdId, { container }) => {
    if (!createdId) {
      return
    }
    const pricingService: IPricingModuleService = container.resolve(Modules.PRICING)
    await pricingService.deletePriceLists([createdId])
  }
)
