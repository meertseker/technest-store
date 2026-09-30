import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendEmailWorkflow } from "../workflows/send-email"

/** customer.created → "Welcome" (registered customers only; see lib/email/sources). */
export default async function customerWelcome({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await sendEmailWorkflow(container).run({
      input: {
        template: "welcome",
        recipient: "customer",
        resource_id: data.id,
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
