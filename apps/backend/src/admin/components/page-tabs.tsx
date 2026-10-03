import { Tabs, clx } from "@medusajs/ui"
import type { ReactNode } from "react"
import { TAP } from "./shop-ui"

/**
 * Tabs for the four owner pages. Triggers are tap-sized and wrap on a phone;
 * each tab's content is given by value so the page stays a plain object.
 */
export function PageTabs<T extends string>({
  tabs,
  value,
  onChange,
  children,
}: {
  tabs: readonly { value: T; label: string }[]
  value: T
  onChange: (tab: T) => void
  children: Record<T, ReactNode>
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
      <Tabs.List className="flex-wrap gap-1">
        {tabs.map((t) => (
          <Tabs.Trigger key={t.value} value={t.value} className={clx(TAP, "px-4 text-base")}>
            {t.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((t) => (
        <Tabs.Content key={t.value} value={t.value} className="mt-4 outline-none">
          {children[t.value]}
        </Tabs.Content>
      ))}
    </Tabs>
  )
}
