import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { safeFirstName } from "../lib/email/order-email-data"
import { sendEmailWorkflow } from "../workflows/send-email"

/** customer.created → "Welcome" for registered customers (not guest checkouts). */
export default async function customerWelcome({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  try {
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "has_account"],
      filters: { id: data.id },
    })
    const customer = customers[0]
    if (!customer?.has_account || !customer.email) {
      return
    }
    await sendEmailWorkflow(container).run({
      input: {
        to: customer.email,
        template: "welcome",
        data: { first_name: safeFirstName(customer.first_name) },
        resource_id: customer.id,
        resource_type: "customer",
        trigger_type: "customer.created",
      },
    })
  } catch (e) {
    logger.error(`welcome email failed for customer ${data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
}
