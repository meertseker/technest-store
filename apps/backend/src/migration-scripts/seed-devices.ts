import { MedusaContainer } from "@medusajs/framework"
import { seedDevices } from "../scripts/seed/devices"

/** Runs once per database: device catalogue + sample product links. */
export default async function seed_devices({
  container,
}: {
  container: MedusaContainer
}) {
  await seedDevices(container)
}
