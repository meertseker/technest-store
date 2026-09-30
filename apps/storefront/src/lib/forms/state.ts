import type { FieldErrors, FormValues } from "./validation"

/**
 * What a form's server action returns (React 19 useActionState).
 * `attempt` changes on every failed submit so the error summary takes focus
 * once per submit, never on blur. `values` refill the fields because React
 * resets uncontrolled forms after an action.
 */
export type FormState = {
  status: "idle" | "error" | "success"
  attempt: number
  errors: FieldErrors
  /** A problem that is not about one field (e.g. "Email or password is incorrect") */
  formError?: string
  values: FormValues
  /** Optional message shown on success */
  message?: string
}

export const initialFormState: FormState = { status: "idle", attempt: 0, errors: {}, values: {} }

export function errorState(
  prev: FormState | undefined,
  values: FormValues,
  errors: FieldErrors,
  formError?: string
): FormState {
  return { status: "error", attempt: (prev?.attempt ?? 0) + 1, errors, values, formError }
}

/** Never echo secrets back to the browser */
export function withoutSecrets(values: FormValues): FormValues {
  const out: FormValues = {}
  for (const [k, v] of Object.entries(values)) {
    if (!/password|token/i.test(k)) out[k] = v
  }
  return out
}

/**
 * A same-site path to go back to after signing in, or the fallback.
 * Rejects absolute URLs, protocol-relative "//evil.test" and "/\evil.test".
 */
export function safeReturnTo(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string" || value.length > 500) return fallback
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback
  if (/[\u0000-\u001f]/.test(value)) return fallback
  return value
}
