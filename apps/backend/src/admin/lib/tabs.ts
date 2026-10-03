import { useCallback } from "react"
import { useSearchParams } from "react-router-dom"

/** The `?tab=` value, or the fallback when it is missing or not one of ours. */
export function parseTab<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  const value = (raw ?? "").trim().toLowerCase()
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/**
 * The open tab lives in the URL (`?tab=delivery`) so Today, the owner guides and
 * bookmarks can open a page on the right tab, and the back button behaves.
 * Other query params (e.g. `drafts=1`) are kept.
 */
export function useUrlTab<T extends string>(allowed: readonly T[], fallback: T): [T, (tab: T) => void] {
  const [params, setParams] = useSearchParams()
  const tab = parseTab(params.get("tab"), allowed, fallback)
  const setTab = useCallback(
    (next: T) => {
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev)
          copy.set("tab", next)
          return copy
        },
        { replace: true }
      )
    },
    [setParams]
  )
  return [tab, setTab]
}
