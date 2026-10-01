"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { ArrowLeft, Search as SearchIcon } from "lucide-react"
import { useState } from "react"
import SearchCombobox from "./search-combobox"

/**
 * Header search (docs/specs/design.md 6), in two parts the header places
 * separately: an inline field with suggestions from 1024px, and below that a
 * search button that opens a full-screen dialog with the same combobox (the
 * spec's Command dialog). Radix Dialog, like the basket drawer and menu, so no
 * second dialog library ships on every page.
 */
export function HeaderSearchField({ className }: { className?: string }) {
  return (
    <div className={className}>
      <SearchCombobox variant="inline" />
    </div>
  )
}

export function HeaderSearchDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded transition-colors duration-150 hover:bg-surface lg:hidden"
        data-testid="nav-search-button"
      >
        <SearchIcon aria-hidden className="size-6" />
        <span className="sr-only">Search products</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          // the search field focuses itself (autoFocus), not the first button
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-[80] flex flex-col bg-background outline-none lg:hidden"
        >
          <div className="flex items-center gap-2 border-b border-border px-2 py-2">
            <Dialog.Close className="inline-flex size-11 cursor-pointer items-center justify-center rounded transition-colors duration-150 hover:bg-surface">
              <ArrowLeft aria-hidden className="size-6" />
              <span className="sr-only">Close search</span>
            </Dialog.Close>
            <Dialog.Title className="text-lg font-semibold">Search</Dialog.Title>
          </div>
          <div className="min-h-0 flex-1">
            <SearchCombobox variant="dialog" autoFocus onNavigate={() => setOpen(false)} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
