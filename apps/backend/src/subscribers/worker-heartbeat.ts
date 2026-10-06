import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { HEARTBEAT_EVENT, heartbeatUrl, pingHeartbeat } from "../lib/alerting/heartbeat"

/**
 * technest.worker.heartbeat (the worker-heartbeat job) → one request to the
 * dead-man's-switch monitor. Never throws: a ping that fails is simply
 * missing, which is what the monitor watches for.
 */
export default async function workerHeartbeat({ container }: SubscriberArgs<{ at: string }>) {
  const url = heartbeatUrl()
  if (!url) return
  await pingHeartbeat(url, container.resolve(ContainerRegistrationKeys.LOGGER))
}

export const config: SubscriberConfig = { event: HEARTBEAT_EVENT }
