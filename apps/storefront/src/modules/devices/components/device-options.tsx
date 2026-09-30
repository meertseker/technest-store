import { Check, ChevronRight } from "lucide-react"
import { chooseDevice } from "@lib/data/device-actions"
import type { Device } from "@/lib/devices/types"

type Props = {
  devices: Pick<Device, "slug" | "model" | "brand">[]
  returnTo?: string | null
  currentSlug?: string | null
  showBrand?: boolean
}

/**
 * One form, one button per device: works without JavaScript (the server
 * action sets the tn_device cookie and redirects back).
 */
export default function DeviceOptions({ devices, returnTo, currentSlug, showBrand }: Props) {
  return (
    <form action={chooseDevice}>
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <ul className="grid gap-2 sm:grid-cols-2">
        {devices.map((d) => {
          const current = d.slug === currentSlug
          return (
            <li key={d.slug}>
              <button
                type="submit"
                name="slug"
                value={d.slug}
                aria-current={current || undefined}
                className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded border border-border bg-background px-4 py-2 text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface aria-[current]:border-success"
              >
                <span>
                  {showBrand && <span className="text-muted-foreground">{d.brand} </span>}
                  <span className="font-semibold">{d.model}</span>
                </span>
                {current ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                    <Check aria-hidden className="size-4" />
                    Selected
                  </span>
                ) : (
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </form>
  )
}
