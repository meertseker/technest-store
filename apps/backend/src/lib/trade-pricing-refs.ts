import {
  FilterablePriceListProps,
  ICustomerModuleService,
  IPricingModuleService,
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { getReference, REFERENCE_KEYS, setReference } from "../modules/settings/references"
import { TRADE_GROUP_NAME, TRADE_PRICE_LIST_TITLE } from "../modules/trade/constants"

type Resolver = { resolve: <T = unknown>(key: string) => T }

/**
 * The Trade customer group and price list are looked up by the ids remembered
 * in the settings module. A database that has the group or list but no stored
 * id yet (created before ids were remembered, or by hand) is resolved by the
 * display name once and the id is stored, so a later rename changes nothing.
 * Null means neither exists; the caller creates it and stores the id.
 */
export async function findTradeGroupId(container: Resolver): Promise<string | null> {
  const customers = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const stored = await getReference(container, REFERENCE_KEYS.TRADE_CUSTOMER_GROUP_ID)
  if (stored) {
    const [group] = await customers.listCustomerGroups({ id: stored }, { select: ["id"], take: 1 })
    if (group) {
      return group.id
    }
  }
  const [byName] = await customers.listCustomerGroups(
    { name: TRADE_GROUP_NAME },
    { select: ["id"], take: 1 }
  )
  if (!byName) {
    return null
  }
  await setReference(container, REFERENCE_KEYS.TRADE_CUSTOMER_GROUP_ID, byName.id)
  return byName.id
}

/** The Trade price list id (any status), see `findTradeGroupId`. */
export async function findTradePriceListId(container: Resolver): Promise<string | null> {
  const pricing = container.resolve<IPricingModuleService>(Modules.PRICING)
  const stored = await getReference(container, REFERENCE_KEYS.TRADE_PRICE_LIST_ID)
  if (stored) {
    const [list] = await pricing.listPriceLists({ id: [stored] }, { select: ["id"], take: 1 })
    if (list) {
      return list.id
    }
  }
  const [byTitle] = await pricing.listPriceLists(
    // `title` is filterable at runtime; the public filter type just doesn't declare it.
    { title: TRADE_PRICE_LIST_TITLE } as FilterablePriceListProps,
    { select: ["id"], take: 1 }
  )
  if (!byTitle) {
    return null
  }
  await setReference(container, REFERENCE_KEYS.TRADE_PRICE_LIST_ID, byTitle.id)
  return byTitle.id
}

/** Remembers a newly created group / list id; returns the previous value for compensation. */
export const rememberTradeGroupId = (container: Resolver, id: string | null) =>
  setReference(container, REFERENCE_KEYS.TRADE_CUSTOMER_GROUP_ID, id)
export const rememberTradePriceListId = (container: Resolver, id: string | null) =>
  setReference(container, REFERENCE_KEYS.TRADE_PRICE_LIST_ID, id)
