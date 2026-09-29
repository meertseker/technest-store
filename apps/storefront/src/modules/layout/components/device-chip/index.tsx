import Link from "next/link"
import { Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = { device: { label: string } | null; className?: string }

/** Static until the device-picker story wires the tn_device cookie */
export default function DeviceChip({ device, className }: Props) {
  return (
    <Link
      href="/devices"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-base text-foreground transition-colors duration-150 hover:bg-surface-2",
        className
      )}
    >
      <Smartphone aria-hidden className="size-5 shrink-0" />
      {device ? (
        <span>
          Shopping for: <strong className="font-semibold">{device.label}</strong>
          <span className="text-muted-foreground"> · change</span>
        </span>
      ) : (
        <span>Choose your device</span>
      )}
    </Link>
  )
}
