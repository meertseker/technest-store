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
const DEFAULT_TIMEOUT_MS = 60_000

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

function timeoutMs() {
  const n = Number(process.env.QUICK_ADD_AI_TIMEOUT_MS)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS
}

/** A client per call: cheap, and picks up env changes (tests point ANTHROPIC_BASE_URL at a stub). */
function client() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
    timeout: timeoutMs(),
    maxRetries: 1,
    // Never let the SDK log requests: they carry the photo and headers.
    logLevel: "off",
  })
}

const fail = (code: AnalyzeFailureCode, message: string): AnalyzeResult => ({
  ok: false,
  code,
  message,
})

/** Asks Claude for a listing draft of the product in the photo. Never throws. */
export async function analyzeProductPhoto(input: {
  image: { media_type: "image/jpeg" | "image/png" | "image/webp"; data: string }
  catalogue: QuickAddCatalogue
}): Promise<AnalyzeResult> {
  if (!aiConfigured()) {
    return fail(
      "ai_unavailable",
      "AI suggestions are switched off (ANTHROPIC_API_KEY is not set). Fill in the details yourself."
    )
  }

  try {
    const response = await client().beta.messages.parse({
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
    })

    if (response.stop_reason === "refusal") {
      return fail(
        "ai_refused",
        "Claude declined to describe this photo. Fill in the details yourself."
      )
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return fail("ai_bad_response", "The AI answer was incomplete. Try again or fill in the details yourself.")
    }
    return { ok: true, draft: response.parsed_output, model: response.model }
  } catch (e) {
    return mapError(e)
  }
}

/** Typed SDK errors, most specific first. Messages are ours: nothing from the request is echoed. */
export function mapError(e: unknown): AnalyzeResult {
  if (e instanceof Anthropic.APIConnectionTimeoutError) {
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
