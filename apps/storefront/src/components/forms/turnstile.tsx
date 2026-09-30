"use client"

import Script from "next/script"
import { useCallback, useEffect, useRef, useState } from "react"
import { FieldError } from "./field"

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
  }
}

/** Field name for its errors, and the id the error summary links to */
export const SECURITY_CHECK = "security_check"

export const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

type Props = {
  /** Change it (e.g. pass the latest server state) to get a fresh token: tokens are single use */
  resetKey?: unknown
  error?: string
}

/**
 * Cloudflare Turnstile (spec 8: no CAPTCHA puzzles). The script is the only
 * third-party script on the page and loads only where this component is
 * rendered (the forms that need it). The widget adds a hidden
 * `cf-turnstile-response` input to the surrounding form.
 */
export default function Turnstile({ resetKey, error }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "done" | "failed">("loading")

  const render = useCallback(() => {
    // (never give an element id="turnstile": it would shadow window.turnstile)
    if (!box.current || typeof window.turnstile?.render !== "function" || widget.current || !siteKey) return
    widget.current = window.turnstile.render(box.current, {
      sitekey: siteKey,
      theme: "light",
      size: "flexible",
      language: "en-GB",
      "response-field-name": "cf-turnstile-response",
      callback: () => setState("done"),
      "expired-callback": () => setState("ready"),
      "error-callback": () => setState("failed"),
    })
    setState("ready")
  }, [siteKey])

  useEffect(() => {
    render()
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [render])

  // A token is spent once the server has seen it: get a new one after every answer
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (widget.current) {
      window.turnstile?.reset(widget.current)
      setState("ready")
    }
  }, [resetKey])

  if (!siteKey) {
    return (
      <p className="rounded bg-warning-subtle p-4 text-warning">
        The security check is not set up, so this form cannot be sent. Please call the shop.
      </p>
    )
  }

  return (
    <div id={SECURITY_CHECK} tabIndex={-1} className="outline-none">
      <p className="font-semibold">Security check</p>
      <p className="text-muted-foreground">
        This runs automatically to stop spam. You may be asked to tick a box.
      </p>
      <FieldError id={`${SECURITY_CHECK}-error`}>{error}</FieldError>
      <Script src={TURNSTILE_SRC} strategy="afterInteractive" onReady={render} onError={() => setState("failed")} />
      <div ref={box} className="mt-2 min-h-[65px]" data-testid="turnstile" data-state={state} />
      {state === "failed" && (
        <p className="mt-1 text-warning">
          The security check could not load. Check your connection and reload the page, or call the shop.
        </p>
      )}
      <noscript>
        <p className="mt-1 text-warning">
          The security check needs JavaScript. If you cannot turn it on, please call the shop to book.
        </p>
      </noscript>
    </div>
  )
}
