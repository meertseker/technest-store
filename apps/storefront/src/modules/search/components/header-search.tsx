"use client"

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { ArrowLeft, Search as SearchIcon } from "lucide-react"
import { useState } from "react"
import SearchCombobox from "./search-combobox"

/**
 * Header search (docs/specs/design.md 6): an inline field with suggestions
 * from 1024px; below that a search button that opens a full-screen dialog
 * with the same combobox (the spec's Command dialog).
 */
export default function HeaderSearch() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="hidden w-64 lg:block xl:w-80">
        <SearchCombobox variant="inline" />
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-surface lg:hidden"
        data-testid="nav-search-button"
      >
        <SearchIcon aria-hidden className="size-6" />
        <span className="sr-only">Search products</span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-[80] lg:hidden">
        <DialogPanel className="fixed inset-0 flex flex-col bg-background">
          <div className="flex items-center gap-2 border-b border-border px-2 py-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex size-11 items-center justify-center rounded hover:bg-surface"
            >
              <ArrowLeft aria-hidden className="size-6" />
              <span className="sr-only">Close search</span>
            </button>
            <DialogTitle className="text-lg font-semibold">Search</DialogTitle>
          </div>
          <div className="min-h-0 flex-1">
            <SearchCombobox variant="dialog" autoFocus onNavigate={() => setOpen(false)} />
          </div>
        </DialogPanel>
      </Dialog>
    </>
  )
}
