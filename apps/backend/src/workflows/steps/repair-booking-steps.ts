import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { REPAIR_MODULE } from "../../modules/repair"
import RepairModuleService from "../../modules/repair/service"
import { RepairBookingStatus } from "../../modules/repair/constants"

export type CreateRepairBookingData = {
  name: string
  phone: string
  email: string
  device: string
  device_id?: string | null
  fault: string
  preferred_time: string
}

export type UpdateRepairBookingData = {
  id: string
  status?: RepairBookingStatus
  notes?: string | null
}

/** An optional device_id must point at an existing device. */
export const validateRepairDeviceStep = createStep(
  "validate-repair-device",
  async ({ device_id }: { device_id?: string | null }, { container }) => {
    if (!device_id) {
      return new StepResponse(undefined)
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "device",
      fields: ["id"],
      filters: { id: device_id },
    })
    if (!data.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Device with id: ${device_id} was not found`
      )
    }
    return new StepResponse(undefined)
  }
)

export const createRepairBookingStep = createStep(
  "create-repair-booking",
  async (data: CreateRepairBookingData, { container }) => {
    const repairService: RepairModuleService = container.resolve(REPAIR_MODULE)
    const booking = await repairService.createRepairBookings(data)
    return new StepResponse(booking, booking.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const repairService: RepairModuleService = container.resolve(REPAIR_MODULE)
    await repairService.deleteRepairBookings(id)
  }
)

export const updateRepairBookingStep = createStep(
  "update-repair-booking",
  async (data: UpdateRepairBookingData, { container }) => {
    const repairService: RepairModuleService = container.resolve(REPAIR_MODULE)
    const previous = await repairService.retrieveRepairBooking(data.id, {
      select: ["id", "status", "notes"],
    })
    const booking = await repairService.updateRepairBookings(data)
    return new StepResponse(booking, {
      id: previous.id,
      status: previous.status,
      notes: previous.notes,
    })
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const repairService: RepairModuleService = container.resolve(REPAIR_MODULE)
    await repairService.updateRepairBookings(previous)
  }
)
