import {
  BatteryCharging,
  Cable,
  Fan,
  Gamepad2,
  Headphones,
  Keyboard,
  Laptop,
  type LucideIcon,
  Package,
  ShieldCheck,
  Smartphone,
  Speaker,
  Tag,
  Usb,
} from "lucide-react"
import type { IconKey } from "@/lib/catalogue/category-icon"
import { cn } from "@/lib/utils"

const ICONS: Record<IconKey, LucideIcon> = {
  phone: Smartphone,
  shield: ShieldCheck,
  battery: BatteryCharging,
  headphones: Headphones,
  speaker: Speaker,
  gamepad: Gamepad2,
  cable: Cable,
  keyboard: Keyboard,
  usb: Usb,
  fan: Fan,
  laptop: Laptop,
  tag: Tag,
  box: Package,
}

const SIZES = {
  /** basket and search thumbnails */
  sm: { disc: "", icon: "size-7" },
  /** product cards: a large, thin line drawing straight on the tile (no disc, which read as a button) */
  md: { disc: "", icon: "size-14 lg:size-16" },
  /** the product page */
  lg: { disc: "", icon: "size-20" },
  /** category tiles: a 44px disc on the surface */
  tile: { disc: "size-11 bg-surface", icon: "size-6" },
}

/**
 * Stand-in for a product or category picture that does not exist yet: an icon
 * for what the thing is, drawn thin and quiet so the tile reads as deliberate
 * rather than broken. Decorative: the name is always next to it.
 */
export default function PhotoPlaceholder({
  icon,
  size = "md",
  className,
}: {
  icon: IconKey
  size?: keyof typeof SIZES
  className?: string
}) {
  const Icon = ICONS[icon]
  const s = SIZES[size]
  return (
    <span
      aria-hidden
      data-placeholder-icon={icon}
      className={cn("flex shrink-0 items-center justify-center rounded-full text-border-strong", s.disc, className)}
    >
      <Icon className={s.icon} strokeWidth={1.25} />
    </span>
  )
}
