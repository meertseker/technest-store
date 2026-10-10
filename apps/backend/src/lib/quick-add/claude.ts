import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import {
  catalogueText,
  ClaudeProductDraft,
  QuickAddCatalogue,
  SYSTEM_PROMPT,
} from "./suggestion"

/**
 * Server-side only. The key comes from ANTHROPIC_API_KEY and never leaves the
 * backend: it is not returned, not logged, and the admin UI never sees it.
 */

/** The current Claude model (vision + structured outputs). */
export const QUICK_ADD_MODEL = "claude-opus-5-5"
/** Re-runs a safety-classifier refusal on Anthropic's recommended fallback model. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01"
/** Per attempt (QUICK_ADD_AI_TIMEOUT_MS). */
const DEFAULT_TIMEOUT_MS = 60_000
/**
 * For the whole call, retries included (QUICK_ADD_AI_DEADLINE_MS). The analyse
 * request is synchronous and the proxy in front of the shop cuts a request off
 * at about two minutes, so everything (download, resize, Claude) must finish
 * inside that. 90 s leaves room for the rest of the request.
 */
const DEFAULT_DEADLINE_MS = 90_000
/** A second attempt is only started when at least this much of the deadline is left. */
const MIN_ATTEMPT_MS = 10_000
const RETRY_PAUSE_MS = 500

export type AnalyzeFailureCode =
  | "ai_unavailable"
  | "ai_timeout"
  | "ai_refused"
  | "ai_bad_response"

export type AnalyzeResult =
  | { ok: true; draft: ClaudeProductDraft; model: string }
  | { ok: false; code: AnalyzeFailureCode; message: string }

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

function positiveMs(name: string, fallback: number) {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? n : fallback
}
const timeoutMs = () => positiveMs("QUICK_ADD_AI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS)
const deadlineMs = () => positiveMs("QUICK_ADD_AI_DEADLINE_MS", DEFAULT_DEADLINE_MS)

/**
 * A client per call: cheap, and picks up env changes (tests point ANTHROPIC_BASE_URL at a stub).
 * Retries are ours (see analyzeProductPhoto): the SDK would retry a timed-out attempt
 * with a fresh timeout, and two attempts in a row would overrun the request.
 */
function client(attemptTimeoutMs: number) {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
    timeout: attemptTimeoutMs,
    maxRetries: 0,
    // Never let the SDK log requests: they carry the photo and headers.
    logLevel: "off",
  })
}

/**
 * Worth one more try: a dropped connection or a server-side error (5xx, which
 * includes "overloaded", and a rate limit). Never a timeout: that attempt already
 * used its share of the deadline. Never a rejected key or a bad request.
 */
function retryable(e: unknown): boolean {
  if (e instanceof Anthropic.APIConnectionTimeoutError || e instanceof Anthropic.APIUserAbortError) {
    return false
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return true
  }
  if (e instanceof Anthropic.APIError) {
    const status = e.status ?? 0
    return status === 408 || status === 409 || status === 429 || status >= 500
  }
  return false
}

const fail = (code: AnalyzeFailureCode, message: string): AnalyzeResult => ({
  ok: false,
  code,
  message,
})

type AnalyzeInput = {
  image: { media_type: "image/jpeg" | "image/png" | "image/webp"; data: string }
  catalogue: QuickAddCatalogue
}

/**
 * Asks Claude for a listing draft of the product in the photo. Never throws.
 * At most two attempts, and the whole call ends by the deadline: each attempt's
 * timeout is capped at the time left, and the abort signal also covers reading
 * the answer (the SDK's timeout only covers waiting for the headers).
 */
export async function analyzeProductPhoto(input: AnalyzeInput): Promise<AnalyzeResult> {
  if (!aiConfigured()) {
    return fail(
      "ai_unavailable",
      "AI suggestions are switched off (ANTHROPIC_API_KEY is not set). Fill in the details yourself."
    )
  }

  const deadline = Date.now() + deadlineMs()
  for (let attempt = 1; ; attempt++) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      return fail("ai_timeout", "The AI took too long to answer. Try again or fill in the details yourself.")
    }
    const result = await attemptOnce(input, Math.min(timeoutMs(), remaining))
    if (result.ok) {
      return result.value
    }
    if (attempt === 2 || !retryable(result.error)) {
      return mapError(result.error)
    }
    if (deadline - Date.now() - RETRY_PAUSE_MS < MIN_ATTEMPT_MS) {
      return mapError(result.error)
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS))
  }
}

async function attemptOnce(
  input: AnalyzeInput,
  attemptTimeoutMs: number
): Promise<{ ok: true; value: AnalyzeResult } | { ok: false; error: unknown }> {
  try {
    const response = await client(attemptTimeoutMs).beta.messages.parse(
      {
      model: QUICK_ADD_MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: {
        // A short visual description task: medium keeps the phone waiting less.
        effort: "medium",
        format: betaZodOutputFormat(ClaudeProductDraft),
      },
      system: [
        {
          type: "text",
          text: `${SYSTEM_PROMPT}\n\n${catalogueText(input.catalogue)}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: input.image.media_type, data: input.image.data },
            },
            { type: "text", text: "Draft the listing for the product in this photo." },
          ],
        },
      ],
      },
      { signal: AbortSignal.timeout(attemptTimeoutMs) }
    )

    if (response.stop_reason === "refusal") {
      return {
        ok: true,
        value: fail("ai_refused", "Claude declined to describe this photo. Fill in the details yourself."),
      }
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return {
        ok: true,
        value: fail("ai_bad_response", "The AI answer was incomplete. Try again or fill in the details yourself."),
      }
    }
    return { ok: true, value: { ok: true, draft: response.parsed_output, model: response.model } }
  } catch (e) {
    return { ok: false, error: e }
  }
}

/** Typed SDK errors, most specific first. Messages are ours: nothing from the request is echoed. */
export function mapError(e: unknown): AnalyzeResult {
  if (e instanceof Anthropic.APIConnectionTimeoutError || e instanceof Anthropic.APIUserAbortError) {
    return fail("ai_timeout", "The AI took too long to answer. Try again or fill in the details yourself.")
  }
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return fail("ai_unavailable", "The AI service rejected our API key. Tell the site admin.")
  }
  if (e instanceof Anthropic.RateLimitError) {
    return fail("ai_unavailable", "The AI service is busy. Try again in a minute.")
  }
  if (e instanceof Anthropic.BadRequestError) {
    return fail("ai_bad_response", "The AI service couldn't read this photo. Try another photo.")
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return fail("ai_unavailable", "The AI service can't be reached. Try again in a minute.")
  }
  if (e instanceof Anthropic.APIError) {
    return fail("ai_unavailable", "The AI service had a problem. Try again in a minute.")
  }
  if (e instanceof Anthropic.AnthropicError) {
    // e.g. "Failed to parse structured output"
    return fail("ai_bad_response", "The AI answer couldn't be read. Try again or fill in the details yourself.")
  }
  return fail("ai_unavailable", "The AI service had a problem. Try again in a minute.")
}
