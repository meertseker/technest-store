import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { reportingSubscriber } from "../lib/alerting"
import { deleteCustomerTradeApplicationsWorkflow } from "../workflows/delete-customer-trade-applications"

/** customer.deleted -> the customer's trade applications are deleted too (personal data). */
async function customerDeletedTradeApplications({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (typeof data?.id !== "string" || !data.id) return
  await deleteCustomerTradeApplicationsWorkflow(container).run({
    input: { customer_id: data.id },
  })
}

export default reportingSubscriber("customer-deleted-trade-applications", customerDeletedTradeApplications)

export const config: SubscriberConfig = {
  event: "customer.deleted",
}
