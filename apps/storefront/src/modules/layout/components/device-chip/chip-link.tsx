import Link from "next/link"
import { Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"

export type ChipDevice = { label: string } | null

type Props = { device: ChipDevice; href: string; className?: string }

/** "Shopping for: iPhone 15 Pro · change" (or "Choose your device") */
export default function DeviceChipLink({ device, href, className }: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-base text-foreground transition-colors duration-150 hover:bg-surface-2",
        className
      )}
    >
      <Smartphone aria-hidden className="size-5 shrink-0" />
      {device ? (
        <span>
          Shopping for: <strong className="font-semibold">{device.label}</strong>
          <span className="text-muted-foreground">
            {" "}
            · <span className="underline underline-offset-4">change</span>
          </span>
        </span>
      ) : (
        <span>Choose your device</span>
      )}
    </Link>
  )
}
