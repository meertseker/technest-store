"use client"

import Image from "next/image"
import { Loader2, Package, Search as SearchIcon, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { formatGbp } from "@/lib/home/select"
import { cn } from "@/lib/utils"
import { MIN_QUERY, nextActive, type Suggestion } from "./suggestions"

const DEBOUNCE_MS = 250

type Props = {
  /** "inline": header field with a dropdown (lg+); "dialog": full-screen list (mobile) */
  variant: "inline" | "dialog"
  autoFocus?: boolean
  onNavigate?: () => void
}

type Status = "idle" | "loading" | "done" | "error"

/**
 * Search autocomplete (ARIA 1.2 combobox with a listbox). Suggestions appear
 * after 2 characters, debounced; arrow keys move through them, Enter opens
 * the highlighted product or, with nothing highlighted, submits the form to
 * /search (which also works without JavaScript). Suggestions come from
 * /api/search/suggest (the shared search client, run on the server).
 */
export default function SearchCombobox({ variant, autoFocus, onNavigate }: Props) {
  const router = useRouter()
  const uid = useId()
  const listId = `${uid}-list`
  const [value, setValue] = useState("")
  const [items, setItems] = useState<Suggestion[]>([])
  const [status, setStatus] = useState<Status>("idle")
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const request = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  const query = value.trim()
  const seeAllHref = `/search?${new URLSearchParams({ q: query })}`
  // The last option is always "See all results"
  const options = query.length >= MIN_QUERY ? [...items.map((i) => `/p/${i.handle}`), seeAllHref] : []

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const runSearch = (q: string) => {
    window.clearTimeout(timer.current)
    if (q.length < MIN_QUERY) {
      request.current++
      setItems([])
      setStatus("idle")
      return
    }
    setStatus("loading")
    timer.current = window.setTimeout(async () => {
      const id = ++request.current
      try {
        const res = await fetch(`/api/search/suggest?${new URLSearchParams({ q })}`)
        if (!res.ok) throw new Error(String(res.status))
        const body = (await res.json()) as { suggestions: Suggestion[] }
        if (id !== request.current) return
        setItems(body.suggestions)
        setStatus("done")
      } catch {
        if (id !== request.current) return
        setItems([])
        setStatus("error")
      }
    }, DEBOUNCE_MS)
  }

  const go = (href: string) => {
    setOpen(false)
    onNavigate?.()
    router.push(href)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!options.length) return
      e.preventDefault()
      setOpen(true)
      const dir = e.key === "ArrowDown" ? 1 : -1
      setActive((a) => nextActive(a, dir, options.length))
    } else if (e.key === "Enter" && active >= 0 && options[active]) {
      e.preventDefault()
      go(options[active])
    } else if (e.key === "Escape") {
      if (open && variant === "inline") {
        e.preventDefault()
        setOpen(false)
        setActive(-1)
      } else if (value) {
        e.preventDefault()
        setValue("")
        runSearch("")
      }
    }
  }

  const expanded = (variant === "dialog" || open) && query.length >= MIN_QUERY
  const optionId = (i: number) => `${uid}-opt-${i}`
  const announce =
    status === "done"
      ? items.length
        ? `${items.length} suggestion${items.length === 1 ? "" : "s"}. Use the arrow keys to choose.`
        : `No suggestions for ${query}. Press Enter to search.`
      : ""

  return (
    <form
      role="search"
      action="/search"
      method="get"
      onSubmit={(e) => {
        e.preventDefault()
        if (query) go(seeAllHref)
      }}
      className={cn("relative", variant === "dialog" && "flex h-full flex-col")}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded border border-border-strong bg-background px-3",
          variant === "dialog" && "mx-4 mt-2"
        )}
      >
        <SearchIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <label htmlFor={`${uid}-q`} className="sr-only">
          Search products
        </label>
        <input
          ref={inputRef}
          id={`${uid}-q`}
          name="q"
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFocus}
          placeholder="Search products"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setActive(-1)
            setOpen(true)
            runSearch(e.target.value.trim())
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => variant === "inline" && window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="min-h-11 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {status === "loading" && <Loader2 aria-hidden className="size-5 shrink-0 animate-spin text-muted-foreground" />}
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("")
              runSearch("")
              inputRef.current?.focus()
            }}
            className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded hover:bg-surface"
          >
            <X aria-hidden className="size-5" />
            <span className="sr-only">Clear search</span>
          </button>
        )}
      </div>

      {/* Only while suggestions are open: the basket count is the header's one standing live region (spec 6) */}
      {expanded && (
        <p role="status" className="sr-only">
          {announce}
        </p>
      )}

      <ul
        id={listId}
        role="listbox"
        aria-label="Search suggestions"
        hidden={!expanded}
        className={cn(
          variant === "inline"
            ? "absolute right-0 top-full z-50 mt-1 w-[26rem] max-w-[calc(100vw-2rem)] rounded border border-border bg-background py-1 shadow-lg"
            : "mt-2 flex-1 overflow-y-auto border-t border-border"
        )}
      >
        {items.map((item, i) => (
          <li
            key={item.id}
            id={optionId(i)}
            role="option"
            aria-selected={active === i}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(options[i])}
            onMouseEnter={() => setActive(i)}
            className={cn(
              "flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2",
              active === i && "bg-surface"
            )}
          >
            <span className="relative size-12 shrink-0 overflow-hidden rounded bg-surface">
              {item.thumbnail ? (
                <Image src={item.thumbnail} alt="" fill sizes="48px" className="object-contain p-1" />
              ) : (
                <Package aria-hidden className="m-3 size-6 text-muted-foreground" strokeWidth={1.5} />
              )}
            </span>
            <span className="line-clamp-2 flex-1">{item.title}</span>
            {item.price !== null && (
              <span className="shrink-0 font-semibold tabular-nums">{formatGbp(item.price)}</span>
            )}
          </li>
        ))}
        {status === "error" && (
          <li role="presentation" className="px-4 py-3 text-muted-foreground">
            Suggestions aren&apos;t available right now.
          </li>
        )}
        {status === "done" && !items.length && (
          <li role="presentation" className="px-4 py-3 text-muted-foreground">
            No suggestions for &ldquo;{query}&rdquo;.
          </li>
        )}
        {query.length >= MIN_QUERY && (
          <li
            id={optionId(items.length)}
            role="option"
            aria-selected={active === items.length}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(seeAllHref)}
            onMouseEnter={() => setActive(items.length)}
            className={cn(
              "flex min-h-12 cursor-pointer items-center px-4 font-semibold underline underline-offset-4",
              active === items.length && "bg-surface"
            )}
          >
            See all results for &ldquo;{query}&rdquo;
          </li>
        )}
      </ul>
    </form>
  )
}
