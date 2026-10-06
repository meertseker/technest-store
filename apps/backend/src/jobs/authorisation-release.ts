import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reportError } from "../lib/alerting"
import { releaseStuckAuthorisations } from "../lib/authorisation-release"

/**
 * Hourly: release the card hold of cancelled orders whose payment is still
 * authorised (the release failed when the order was cancelled).
 */
export default async function authorisationReleaseJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const { released, failed } = await releaseStuckAuthorisations(container, new Date())
    if (released || failed) {
      logger.info(`authorisation-release: ${released} released, ${failed} failed`)
    }
  } catch (e) {
    // Don't throw from a scheduled job: log and try again next hour.
    logger.error(`authorisation-release: run failed: ${(e as Error).message}`)
    reportError(e, { source: "job:authorisation-release" })
  }
}

export const config = {
  name: "authorisation-release",
  schedule: "20 * * * *",
}
