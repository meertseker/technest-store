import { Suspense } from "react"
import { PICKER_PATH } from "@/lib/devices/cookie"
import DeviceChip from "."
import DeviceChipLink, { type ChipDevice } from "./chip-link"

type Props = { device: ChipDevice; className?: string }

/** The chip inside the Suspense boundary that useSearchParams requires */
export default function DeviceChipSlot(props: Props) {
  return (
    <Suspense fallback={<DeviceChipLink {...props} href={PICKER_PATH} />}>
      <DeviceChip {...props} />
    </Suspense>
  )
}
