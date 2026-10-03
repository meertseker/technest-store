import { Input, Label, Select, Text } from "@medusajs/ui"
import type { ReactNode } from "react"
import { DEVICE_TYPES, Device, DeviceInput, DeviceType } from "../../lib/types"

// Form fields shared by "Add device" (FocusModal) and "Edit device" (Drawer).

export type DeviceFormValues = {
  brand: string
  series: string
  model: string
  type: DeviceType | ""
  slug: string
  aliases: string
  release_year: string
  image_url: string
}

export type DeviceFormErrors = Partial<Record<keyof DeviceFormValues, string>>

export const TYPE_LABELS: Record<DeviceType, string> = {
  phone: "Phone",
  tablet: "Tablet",
  console: "Games console",
  laptop: "Laptop",
}

export const EMPTY_DEVICE_FORM: DeviceFormValues = {
  brand: "",
  series: "",
  model: "",
  type: "",
  slug: "",
  aliases: "",
  release_year: "",
  image_url: "",
}

export function formFromDevice(d: Device): DeviceFormValues {
  return {
    brand: d.brand,
    series: d.series,
    model: d.model,
    type: d.type,
    slug: d.slug,
    aliases: d.aliases.join(", "),
    release_year: d.release_year ? String(d.release_year) : "",
    image_url: d.image_url ?? "",
  }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function validateDeviceForm(v: DeviceFormValues): DeviceFormErrors {
  const errors: DeviceFormErrors = {}
  if (!v.brand.trim()) errors.brand = "Enter the brand, e.g. Apple."
  if (!v.series.trim()) errors.series = "Enter the series, e.g. iPhone 16."
  if (!v.model.trim()) errors.model = "Enter the model, e.g. iPhone 16 Pro."
  if (!v.type) errors.type = "Choose what kind of device it is."
  if (v.slug.trim() && !SLUG.test(v.slug.trim()))
    errors.slug = "Use lowercase letters, numbers and dashes only, e.g. iphone-16-pro."
  if (v.release_year.trim()) {
    const year = Number(v.release_year)
    if (!Number.isInteger(year) || year < 1990 || year > 2100)
      errors.release_year = "Enter a year like 2024, or leave it empty."
  }
  if (v.image_url.trim()) {
    try {
      new URL(v.image_url.trim())
    } catch {
      errors.image_url = "Enter a full web address starting with https://, or leave it empty."
    }
  }
  return errors
}

/** Body for POST /admin/devices and POST /admin/devices/:id. */
export function toDeviceInput(v: DeviceFormValues): DeviceInput {
  const slug = v.slug.trim()
  return {
    brand: v.brand.trim(),
    series: v.series.trim(),
    model: v.model.trim(),
    type: v.type as DeviceType,
    ...(slug ? { slug } : {}),
    aliases: v.aliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean),
    release_year: v.release_year.trim() ? Number(v.release_year) : null,
    image_url: v.image_url.trim() || null,
  }
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-2">
      <Label htmlFor={id} size="base" weight="plus">
        {label}
      </Label>
      {hint && (
        <Text size="large" id={`${id}-hint`} className="text-ui-fg-subtle">
          {hint}
        </Text>
      )}
      {children}
      {error && (
        <Text size="large" id={`${id}-error`} className="text-ui-fg-error" role="alert">
          {error}
        </Text>
      )}
    </div>
  )
}

export function DeviceFormFields({
  idPrefix,
  values,
  errors,
  onChange,
  isEdit,
}: {
  idPrefix: string
  values: DeviceFormValues
  errors: DeviceFormErrors
  onChange: (values: DeviceFormValues, field: keyof DeviceFormValues) => void
  isEdit?: boolean
}) {
  const text = (field: keyof DeviceFormValues, label: string, hint?: string, extra = {}) => {
    const id = `${idPrefix}-${field}`
    const describedBy = [hint && `${id}-hint`, errors[field] && `${id}-error`]
      .filter(Boolean)
      .join(" ")
    return (
      <Field id={id} label={label} hint={hint} error={errors[field]}>
        <Input
          id={id}
          size="base"
          className="min-h-11 text-base"
          value={values[field]}
          aria-invalid={!!errors[field]}
          aria-describedby={describedBy || undefined}
          onChange={(e) => onChange({ ...values, [field]: e.target.value }, field)}
          {...extra}
        />
      </Field>
    )
  }

  return (
    <div className="flex flex-col gap-y-5">
      {text("brand", "Brand", undefined, { placeholder: "Apple" })}
      {text("series", "Series", "The group it is listed under, e.g. iPhone 16 or Galaxy S24.", {
        placeholder: "iPhone 16",
      })}
      {text("model", "Model", undefined, { placeholder: "iPhone 16 Pro" })}
      <Field id={`${idPrefix}-type`} label="Kind of device" error={errors.type}>
        <Select
          value={values.type || undefined}
          onValueChange={(t) => onChange({ ...values, type: t as DeviceType }, "type")}
        >
          <Select.Trigger
            id={`${idPrefix}-type`}
            className="min-h-11"
            aria-invalid={!!errors.type}
          >
            <Select.Value placeholder="Choose…" />
          </Select.Trigger>
          <Select.Content>
            {DEVICE_TYPES.map((t) => (
              <Select.Item key={t} value={t}>
                {TYPE_LABELS[t]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </Field>
      {text(
        "aliases",
        "Other names (optional)",
        "Separate with commas. Include model numbers customers might search for, e.g. 16 pro, A3102."
      )}
      {text("release_year", "Year released (optional)", undefined, {
        inputMode: "numeric",
        placeholder: "2024",
      })}
      {text(
        "slug",
        isEdit ? "Web address name" : "Web address name (optional)",
        isEdit
          ? "Used in the shop's web address. Changing it breaks old links to this device."
          : "Leave empty to make it from the model name, e.g. iphone-16-pro."
      )}
      {text("image_url", "Picture web address (optional)", undefined, {
        inputMode: "url",
        placeholder: "https://…",
      })}
    </div>
  )
}
