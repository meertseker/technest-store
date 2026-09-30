"use client"

import { useActionState, useState, type FormEvent } from "react"
import { errorState, initialFormState, type FormState } from "@/lib/forms/state"
import { hasErrors, readForm, type FieldErrors, type FormValues } from "@/lib/forms/validation"

type Action = (prev: FormState, formData: FormData) => Promise<FormState>

/**
 * A server action plus the same validation in the browser first, so the
 * error summary appears without a round trip. Without JavaScript the form
 * still posts to the action, which validates again and returns the errors.
 */
export function useValidatedForm(
  action: Action,
  validate: (values: FormValues) => FieldErrors,
  fields: readonly string[],
  initial: FormState = initialFormState
) {
  const [serverState, formAction, pending] = useActionState(action, initial)
  const [clientState, setClientState] = useState<{ for: FormState; state: FormState } | null>(null)

  // A client-side result is only valid until the server answers again
  const state = clientState && clientState.for === serverState ? clientState.state : serverState

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const values = readForm(new FormData(e.currentTarget), fields)
    const errors = validate(values)
    if (hasErrors(errors)) {
      e.preventDefault()
      setClientState({ for: serverState, state: errorState(state, values, errors) })
    } else {
      setClientState(null)
    }
  }

  return { state, serverState, formAction, onSubmit, pending }
}
