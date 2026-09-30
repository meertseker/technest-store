"use client"

import { Check } from "lucide-react"
import { useId, useMemo, useRef, useState } from "react"
import { describedBy, FieldError, FieldHint, FieldLabel, inputClass } from "@/components/forms/field"
import { searchDevices } from "@/lib/devices/tree"
import type { Device, DeviceTree } from "@/lib/devices/types"
import { cn } from "@/lib/utils"

type Props = {
  tree: DeviceTree
  defaultDevice?: Pick<Device, "id" | "model"> | null
  defaultText?: string
  defaultId?: string
  error?: string
}

const LIMIT = 8

/**
 * The device picker as a form field (WAI-ARIA APG editable combobox with a
 * list). Typing searches the same catalogue as the header device picker;
 * choosing a match fills `device` and the hidden `device_id`. Any other text
 * is fine too (the contract takes free text, and the id is optional), so an
 * unlisted or very old device can still be booked.
 */
export default function DeviceField({ tree, defaultDevice, defaultText, defaultId, error }: Props) {
  const listId = useId()
  const [text, setText] = useState(defaultText ?? defaultDevice?.model ?? "")
  const [deviceId, setDeviceId] = useState(defaultId ?? defaultDevice?.id ?? "")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)

  const results = useMemo(() => (open ? searchDevices(tree, text, LIMIT) : []), [tree, text, open])
  const expanded = open && results.length > 0
  const hint = "Start typing, for example iPhone 13 mini or PS5, and choose it from the list. Not listed? Just type it."

  const choose = (d: Device) => {
    setText(d.model)
    setDeviceId(d.id)
    setOpen(false)
    setActive(-1)
  }

  return (
    <div className="flex flex-col">
      <FieldLabel htmlFor="device">Your device</FieldLabel>
      <FieldHint id="device-hint">{hint}</FieldHint>
      <FieldError id="device-error">{error}</FieldError>
      <div className="relative mt-2">
        <input
          ref={input}
          id="device"
          name="device"
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          maxLength={200}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy("device", hint, error)}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setDeviceId("")
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => text && !deviceId && setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setOpen(true)
              setActive((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter" && expanded && active >= 0) {
              e.preventDefault()
              choose(results[active])
            } else if (e.key === "Escape" && expanded) {
              e.preventDefault()
              setOpen(false)
            }
          }}
          className={inputClass}
        />
        <input type="hidden" name="device_id" value={deviceId} />
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching devices"
          hidden={!expanded}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded border border-border-strong bg-background py-1 shadow-lg"
        >
          {results.map((d, i) => (
            <li
              key={d.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: keeps focus in the input and fires before blur
              onMouseDown={(e) => {
                e.preventDefault()
                choose(d)
              }}
              className={cn(
                "flex min-h-11 cursor-pointer items-center px-4 py-2",
                i === active ? "bg-surface-2" : "hover:bg-surface"
              )}
            >
              <span className="text-muted-foreground">{d.brand}&nbsp;</span>
              <span className="font-semibold">{d.model}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* Announce the number of matches and a confirmed choice (only live region here) */}
      <p role="status" className="sr-only">
        {expanded ? `${results.length} ${results.length === 1 ? "device matches" : "devices match"}, use the arrow keys to choose` : ""}
      </p>
      {deviceId && (
        <p className="mt-1 inline-flex items-center gap-1 font-semibold text-success">
          <Check aria-hidden className="size-5" />
          {text} chosen from our device list
        </p>
      )}
    </div>
  )
}
