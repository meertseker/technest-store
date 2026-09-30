import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { PencilSquare } from "@medusajs/icons"
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ReactNode, useEffect, useRef, useState } from "react"
import { FilterChips, PageLoading, TAP } from "../components/shop-ui"
import { sdk } from "../lib/client"
import { errorMessage } from "../lib/format"
import {
  AttributesForm,
  AttributesPayload,
  CONNECTOR_SUGGESTIONS,
  FormErrors,
  PLATFORM_LABELS,
  PLATFORMS,
  ProductAttributes,
  ProductAttributesResponse,
  PublishCheck,
  SAFETY_MARKING_LABELS,
  SAFETY_MARKINGS,
  markingLabel,
  toForm,
  toPayload,
  withUnit,
} from "../lib/product-attributes"

// "Product details for Tech Nest" on the product page (ADR 0001,
// docs/contracts/product-attributes.md): GET/POST /admin/products/:id/attributes.
// The owner edits these on a phone: 44px buttons and 16px text throughout.

const ADDON_HELP =
  "£1 add-on: can't be delivered on its own; Click & Collect is fine. Also add it to the £1 Deals category so the 3-for-£2 offer applies."
const REORDER_HELP =
  "When stock of any variant falls to this number or below, it goes on the low-stock email at 08:00."
const SAFETY_HELP =
  "Chargers, cables and power products need UKCA or CE before they can be published. Check the box or the product itself for the mark."

const ProductAttributesWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<AttributesForm | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})

  // Category changes are saved elsewhere on the page; keying on them re-runs the publish check.
  const categoryIds = (product.categories ?? []).map((c) => c.id).sort()
  const baseKey = ["product-attributes", product.id]

  // Display query: loads on mount.
  const attrs = useQuery({
    queryKey: [...baseKey, categoryIds],
    queryFn: () =>
      sdk.client.fetch<ProductAttributesResponse>(`/admin/products/${product.id}/attributes`),
  })

  const save = useMutation({
    mutationFn: (body: AttributesPayload) =>
      sdk.client.fetch<ProductAttributesResponse>(`/admin/products/${product.id}/attributes`, {
        method: "POST",
        body,
      }),
    onSuccess: (res) => {
      queryClient.setQueryData([...baseKey, categoryIds], res)
      queryClient.invalidateQueries({ queryKey: baseKey })
      queryClient.invalidateQueries({
        queryKey: ["products", "detail", product.id],
      })
      toast.success("Product details saved.")
      closeDrawer()
    },
  })

  // The server's message sits at the top of the drawer; bring it into view on a phone.
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (save.isError) errorRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [save.isError, save.failureCount])

  const current = attrs.data?.product_attributes
  const check = attrs.data?.publish_check

  const openDrawer = () => {
    if (!current) return
    setForm(toForm(current))
    setErrors({})
    save.reset()
    setOpen(true)
  }

  const closeDrawer = () => {
    setOpen(false)
    setForm(null)
    setErrors({})
  }

  const submit = () => {
    if (!form || !current) return
    const { payload, errors: found } = toPayload(form, current)
    setErrors(found)
    if (Object.keys(found).length) return
    if (!Object.keys(payload).length) {
      closeDrawer()
      return
    }
    save.mutate(payload)
  }

  const update = <K extends keyof AttributesForm>(key: K, value: AttributesForm[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-2 px-6 py-4">
        <Heading level="h2">Product details for Tech Nest</Heading>
        <Button
          type="button"
          size="small"
          variant="secondary"
          className={TAP}
          onClick={openDrawer}
          disabled={!current}
        >
          <PencilSquare />
          Edit
        </Button>
      </div>

      {attrs.isLoading ? (
        <PageLoading />
      ) : attrs.isError || !current || !check ? (
        <div className="px-6 py-4">
          <Alert variant="error">
            <Text size="large">{errorMessage(attrs.error)}</Text>
          </Alert>
        </div>
      ) : (
        <>
          <PublishStatus check={check} status={product.status} />
          <div className="flex flex-col py-2">
            <Row label="Safety marking">
              <MarkingBadge
                marking={current.safety_marking}
                required={check.needs_safety_marking}
              />
            </Row>
            <Row label="£1 add-on">
              <Text size="large">{current.is_addon_item ? "Yes" : "No"}</Text>
            </Row>
            <Row label="Reorder level">
              <Text size="large">{`Email when ${current.reorder_level} or fewer left`}</Text>
            </Row>
            <Row label="Connectors">
              <Text size="large">{connectors(current)}</Text>
            </Row>
            <Row label="Wattage">
              <Text size="large">{withUnit(current.wattage, "W")}</Text>
            </Row>
            <Row label="Cable length">
              <Text size="large">{withUnit(current.cable_length_m, "m")}</Text>
            </Row>
            <Row label="Platforms">
              <Text size="large">
                {current.platform.length
                  ? current.platform.map((p) => PLATFORM_LABELS[p] ?? p).join(", ")
                  : "-"}
              </Text>
            </Row>
            <Row label="Warranty">
              <Text size="large">{withUnit(current.warranty_months, "month", "months")}</Text>
            </Row>
          </div>
        </>
      )}

      <Drawer
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : !save.isPending && closeDrawer())}
      >
        <Drawer.Content>
          {form && check && (
            <form
              className="flex h-full flex-col overflow-hidden"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <Drawer.Header>
                <Drawer.Title>Product details</Drawer.Title>
                <Drawer.Description className="txt-medium">{product.title}</Drawer.Description>
              </Drawer.Header>
              <Drawer.Body className="flex flex-1 flex-col gap-y-6 overflow-auto p-4">
                {save.isError && (
                  <Alert variant="error" role="alert" ref={errorRef} className="scroll-mt-4">
                    <Text size="large">{errorMessage(save.error)}</Text>
                  </Alert>
                )}

                <fieldset className="flex flex-col gap-y-2">
                  <legend className="mb-2">
                    <Text size="large" weight="plus">
                      Safety marking
                    </Text>
                  </legend>
                  <Text size="large" className="text-ui-fg-subtle">
                    {SAFETY_HELP}
                  </Text>
                  <FilterChips
                    label="Safety marking"
                    value={form.safety_marking}
                    onChange={(v) => update("safety_marking", v)}
                    options={SAFETY_MARKINGS.map((m) => ({
                      value: m,
                      label: SAFETY_MARKING_LABELS[m],
                    }))}
                  />
                  {check.needs_safety_marking && form.safety_marking === "none" && (
                    <Alert variant="warning">
                      <Text size="large">
                        {product.status === "published"
                          ? "This product is published in a charger or power category, so saving it without UKCA or CE will be refused."
                          : "This product is in a charger or power category. It can't be published until you choose UKCA or CE."}
                      </Text>
                    </Alert>
                  )}
                </fieldset>

                <div className="flex flex-col gap-y-2">
                  <label
                    htmlFor="attr-addon"
                    className="flex min-h-11 cursor-pointer items-center justify-between gap-3"
                  >
                    <Text as="span" size="large" weight="plus">
                      £1 add-on item
                    </Text>
                    <Switch
                      id="attr-addon"
                      checked={form.is_addon_item}
                      aria-describedby="attr-addon-hint"
                      onCheckedChange={(c) => update("is_addon_item", c === true)}
                    />
                  </label>
                  <Text size="large" id="attr-addon-hint" className="text-ui-fg-subtle">
                    {ADDON_HELP}
                  </Text>
                </div>

                <NumberField
                  id="attr-reorder"
                  label="Reorder level"
                  hint={REORDER_HELP}
                  value={form.reorder_level}
                  error={errors.reorder_level}
                  inputMode="numeric"
                  onChange={(v) => update("reorder_level", v)}
                />

                <datalist id="attr-connector-options">
                  {CONNECTOR_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    id="attr-connector-a"
                    label="Connector A"
                    hint="e.g. USB-C"
                    value={form.connector_a}
                    error={errors.connector_a}
                    onChange={(v) => update("connector_a", v)}
                  />
                  <TextField
                    id="attr-connector-b"
                    label="Connector B"
                    hint="e.g. Lightning"
                    value={form.connector_b}
                    error={errors.connector_b}
                    onChange={(v) => update("connector_b", v)}
                  />
                  <NumberField
                    id="attr-wattage"
                    label="Wattage (W)"
                    hint="Leave empty if it doesn't apply."
                    value={form.wattage}
                    error={errors.wattage}
                    inputMode="decimal"
                    onChange={(v) => update("wattage", v)}
                  />
                  <NumberField
                    id="attr-cable"
                    label="Cable length (m)"
                    hint="e.g. 1 or 1.5"
                    value={form.cable_length_m}
                    error={errors.cable_length_m}
                    inputMode="decimal"
                    onChange={(v) => update("cable_length_m", v)}
                  />
                  <NumberField
                    id="attr-warranty"
                    label="Warranty (months)"
                    hint="Whole months, e.g. 12"
                    value={form.warranty_months}
                    error={errors.warranty_months}
                    inputMode="numeric"
                    onChange={(v) => update("warranty_months", v)}
                  />
                </div>

                <fieldset className="flex flex-col gap-y-1">
                  <legend className="mb-1">
                    <Text size="large" weight="plus">
                      Platforms
                    </Text>
                  </legend>
                  <Text size="large" className="text-ui-fg-subtle">
                    For gaming accessories: shown as a filter in the shop.
                  </Text>
                  <div className="grid grid-cols-1 sm:grid-cols-2">
                    {PLATFORMS.map((p) => {
                      const id = `attr-platform-${p}`
                      const checked = form.platform.includes(p)
                      return (
                        <label
                          key={p}
                          htmlFor={id}
                          className="flex min-h-11 cursor-pointer items-center gap-3"
                        >
                          <Checkbox
                            id={id}
                            checked={checked}
                            onCheckedChange={(c) =>
                              update(
                                "platform",
                                c === true
                                  ? [...form.platform, p]
                                  : form.platform.filter((x) => x !== p)
                              )
                            }
                          />
                          <Text as="span" size="large">
                            {PLATFORM_LABELS[p]}
                          </Text>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              </Drawer.Body>
              <Drawer.Footer>
                <div className="flex w-full items-center justify-end gap-x-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className={TAP}
                    onClick={closeDrawer}
                    disabled={save.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className={TAP}
                    isLoading={save.isPending}
                    disabled={save.isPending}
                  >
                    Save
                  </Button>
                </div>
              </Drawer.Footer>
            </form>
          )}
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

function connectors(a: ProductAttributes) {
  const ends = [a.connector_a, a.connector_b].filter(Boolean)
  return ends.length ? ends.join(" to ") : "-"
}

/** Label/value pair sized for the narrow side column (two columns even on a phone). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline gap-3 px-6 py-3">
      <Text size="large" weight="plus" className="text-ui-fg-subtle">
        {label}
      </Text>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  )
}

function MarkingBadge({
  marking,
  required,
}: {
  marking: ProductAttributes["safety_marking"]
  required: boolean
}) {
  if (marking !== "none") {
    return (
      <Badge size="base" color="green">
        {markingLabel(marking)}
      </Badge>
    )
  }
  return required ? (
    <Badge size="base" color="red">
      Needs UKCA or CE
    </Badge>
  ) : (
    <Text size="large">None</Text>
  )
}

/** Warning at the top when the publish guard would refuse this product. */
function PublishStatus({ check, status }: { check: PublishCheck; status: AdminProduct["status"] }) {
  if (!check.blocked_reason) return null
  const published = status === "published"
  return (
    <div className="px-6 py-4">
      <Alert variant={published ? "error" : "warning"}>
        <Text size="large" weight="plus">
          {published ? "Breaks the listing rules" : "Can't be published yet"}
        </Text>
        <Text size="large">{check.blocked_reason}</Text>
      </Alert>
    </div>
  )
}

type FieldProps = {
  id: string
  label: string
  hint: string
  value: string
  error?: string
  onChange: (value: string) => void
}

function TextField({ id, label, hint, value, error, onChange }: FieldProps) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      value={value}
      error={error}
      onChange={onChange}
      list="attr-connector-options"
    />
  )
}

function NumberField(props: FieldProps & { inputMode: "numeric" | "decimal" }) {
  return <Field {...props} />
}

function Field({
  id,
  label,
  hint,
  value,
  error,
  onChange,
  inputMode,
  list,
}: FieldProps & { inputMode?: "numeric" | "decimal"; list?: string }) {
  const described = `${id}-hint${error ? ` ${id}-error` : ""}`
  return (
    <div className="flex flex-col gap-y-2">
      <Label htmlFor={id} size="base" weight="plus">
        {label}
      </Label>
      <Text size="large" id={`${id}-hint`} className="text-ui-fg-subtle">
        {hint}
      </Text>
      <Input
        id={id}
        className="min-h-11 text-base"
        value={value}
        inputMode={inputMode}
        list={list}
        autoComplete="off"
        aria-invalid={!!error}
        aria-describedby={described}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <Text size="large" id={`${id}-error`} className="text-ui-fg-error" role="alert">
          {error}
        </Text>
      )}
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side",
})

export default ProductAttributesWidget
