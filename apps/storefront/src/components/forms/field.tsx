import { AlertCircle } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Form fields (spec 4 + 8): label above, optional hint, inline error below
 * with an icon, 48px tall, 16px text, 3:1 border. The error and hint are
 * linked with aria-describedby and the field gets aria-invalid.
 * No hooks, so these render on the server too.
 */

export const inputClass =
  "block min-h-12 w-full rounded border border-border-strong bg-background px-4 py-2 text-base text-foreground transition-colors duration-150 aria-[invalid=true]:border-2 aria-[invalid=true]:border-destructive"

type Common = {
  /** Also the input's name and id (links in the error summary point at #id) */
  name: string
  label: React.ReactNode
  hint?: React.ReactNode
  error?: string
  /** "(optional)" after the label; required fields are the default and unmarked (GOV.UK) */
  optional?: boolean
  className?: string
}

export const describedBy = (name: string, hint?: unknown, error?: unknown) =>
  [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(" ") || undefined

export function FieldLabel({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block font-semibold">
      {children}
      {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
    </label>
  )
}

export function FieldHint({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1 text-base text-muted-foreground">
      {children}
    </p>
  )
}

export function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null
  return (
    <p id={id} className="mt-1 flex items-start gap-2 font-semibold text-destructive">
      <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
      <span>
        <span className="sr-only">Error: </span>
        {children}
      </span>
    </p>
  )
}

function FieldShell({
  name,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: Common & { children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <FieldLabel htmlFor={name} optional={optional}>
        {label}
      </FieldLabel>
      {hint && <FieldHint id={`${name}-hint`}>{hint}</FieldHint>}
      <FieldError id={`${name}-error`}>{error}</FieldError>
      <div className="mt-2">{children}</div>
    </div>
  )
}

export type TextFieldProps = Common &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "id" | "className"> & {
    inputClassName?: string
  }

export function TextField({ name, label, hint, error, optional, className, inputClassName, ...rest }: TextFieldProps) {
  return (
    <FieldShell name={name} label={label} hint={hint} error={error} optional={optional} className={className}>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={cn(inputClass, inputClassName)}
        {...rest}
      />
    </FieldShell>
  )
}

export type TextAreaFieldProps = Common &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id" | "className">

export function TextAreaField({ name, label, hint, error, optional, className, rows = 5, ...rest }: TextAreaFieldProps) {
  return (
    <FieldShell name={name} label={label} hint={hint} error={error} optional={optional} className={className}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={cn(inputClass, "leading-relaxed")}
        {...rest}
      />
    </FieldShell>
  )
}

export type SelectFieldProps = Common &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name" | "id" | "className"> & {
    options: readonly { value: string; label: string }[]
    placeholder?: string
  }

export function SelectField({ name, label, hint, error, optional, className, options, placeholder, ...rest }: SelectFieldProps) {
  return (
    <FieldShell name={name} label={label} hint={hint} error={error} optional={optional} className={className}>
      <select
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={cn(inputClass, "cursor-pointer")}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

type RadioGroupProps = Common & {
  options: readonly { value: string; label: string; hint?: string }[]
  defaultValue?: string
}

/**
 * A fieldset of radios. The first radio carries id={name} so the error
 * summary link lands on the group.
 */
export function RadioGroup({ name, label, hint, error, options, defaultValue, className, optional }: RadioGroupProps) {
  return (
    <fieldset className={cn("flex flex-col", className)} aria-describedby={describedBy(name, hint, error)}>
      <legend className="font-semibold">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </legend>
      {hint && <FieldHint id={`${name}-hint`}>{hint}</FieldHint>}
      <FieldError id={`${name}-error`}>{error}</FieldError>
      <div className="mt-2 flex flex-col gap-2">
        {options.map((o, i) => (
          <label
            key={o.value}
            className="flex min-h-12 cursor-pointer items-start gap-3 rounded border border-border px-4 py-3 transition-colors duration-150 hover:bg-surface has-[:checked]:border-foreground has-[:checked]:bg-surface"
          >
            <input
              type="radio"
              id={i === 0 ? name : `${name}-${o.value}`}
              name={name}
              value={o.value}
              defaultChecked={defaultValue === o.value}
              className="mt-0.5 size-6 shrink-0 cursor-pointer accent-foreground"
            />
            <span>
              <span className="block">{o.label}</span>
              {o.hint && <span className="block text-muted-foreground">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

type CheckboxFieldProps = Omit<Common, "optional"> & {
  value?: string
  defaultChecked?: boolean
}

export function CheckboxField({ name, label, hint, error, className, value = "yes", defaultChecked }: CheckboxFieldProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <FieldError id={`${name}-error`}>{error}</FieldError>
      <label className="mt-1 flex min-h-12 cursor-pointer items-start gap-3 py-2">
        <input
          type="checkbox"
          id={name}
          name={name}
          value={value}
          defaultChecked={defaultChecked}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(name, hint, error)}
          className="mt-0.5 size-6 shrink-0 cursor-pointer accent-foreground"
        />
        <span>{label}</span>
      </label>
      {hint && <FieldHint id={`${name}-hint`}>{hint}</FieldHint>}
    </div>
  )
}
