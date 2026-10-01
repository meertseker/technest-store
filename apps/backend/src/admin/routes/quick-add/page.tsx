import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Camera } from "@medusajs/icons"
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Label,
  RadioGroup,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { PhotoCompare } from "../../components/photo-compare"
import { sdk } from "../../lib/client"
import { ownerMessage } from "../../lib/today"
import {
  approvePhoto,
  errorMessage,
  photoStatusQuery,
  processPhoto,
  ProcessResult,
  StoredFile,
  uploadOriginal,
} from "../../lib/photos"
import {
  AnalyzeResponse,
  CreateBody,
  CreatedProduct,
  DeviceOption,
  PRODUCT_TYPES,
  ProductType,
  QuickAddStatus,
  SafetyMarking,
  Suggestion,
} from "./types"

const NONE = "__none__"
const MAX_PHOTO_BYTES = 25 * 1024 * 1024

type Form = {
  title: string
  description: string
  category_id: string
  product_type: ProductType | ""
  devices: { id: string; name: string }[]
  price: string
  sku: string
  stock: string
  safety_marking: SafetyMarking
  safety_marking_confirmed: boolean
  connector_a: string
  connector_b: string
  wattage: string
}

const EMPTY_FORM: Form = {
  title: "",
  description: "",
  category_id: "",
  product_type: "",
  devices: [],
  price: "",
  sku: "",
  stock: "1",
  safety_marking: "none",
  safety_marking_confirmed: false,
  connector_a: "",
  connector_b: "",
  wattage: "",
}

const fromSuggestion = (s: Suggestion): Form => ({
  ...EMPTY_FORM,
  title: s.title,
  description: s.description,
  category_id: s.category?.id ?? "",
  product_type: s.product_type,
  devices: s.devices.map((d) => ({ id: d.id, name: d.name })),
  // The AI price is only a hint: staff must type or accept it knowingly.
  price: "",
  safety_marking: s.safety_marking.guess,
  // Never pre-ticked: staff confirm against the label.
  safety_marking_confirmed: false,
  connector_a: s.attributes.connector_a ?? "",
  connector_b: s.attributes.connector_b ?? "",
  wattage: s.attributes.wattage?.toString() ?? "",
})

const toNumberOrNull = (s: string) => {
  const n = Number(s.trim().replace(",", "."))
  return s.trim() && Number.isFinite(n) ? n : null
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-y-2">
      <Label htmlFor={id} size="base" weight="plus">
        {label}
      </Label>
      {children}
      {hint && (
        <Text size="base" className="text-ui-fg-subtle" id={`${id}-hint`}>
          {hint}
        </Text>
      )}
    </div>
  )
}

/** Selected devices as removable chips, plus a search to add more. */
function DevicePicker({
  value,
  onChange,
}: {
  value: Form["devices"]
  onChange: (devices: Form["devices"]) => void
}) {
  const [q, setQ] = useState("")
  const [debounced, setDebounced] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const { data, isFetching } = useQuery({
    queryKey: ["quick-add-devices", debounced],
    queryFn: () =>
      sdk.client.fetch<{ devices: DeviceOption[] }>("/admin/devices", {
        query: { q: debounced, limit: 8 },
      }),
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
  })
  const results = (debounced.length >= 2 ? data?.devices ?? [] : []).filter(
    (d) => !value.some((v) => v.id === d.id)
  )

  return (
    <div className="flex flex-col gap-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Selected devices">
          {value.map((d) => (
            <li key={d.id}>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                aria-label={`Remove ${d.name}`}
                onClick={() => onChange(value.filter((v) => v.id !== d.id))}
              >
                {d.name} ✕
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id="qa-devices"
        type="search"
        placeholder="Search devices, e.g. iPhone 16"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="min-h-11"
        autoComplete="off"
      />
      {isFetching && (
        <Text size="base" className="text-ui-fg-subtle" role="status">
          Searching…
        </Text>
      )}
      {results.length > 0 && (
        <ul className="flex flex-col gap-y-1" aria-label="Matching devices">
          {results.map((d) => (
            <li key={d.id}>
              <Button
                type="button"
                variant="transparent"
                className="min-h-11 w-full justify-start"
                onClick={() => {
                  onChange([...value, { id: d.id, name: `${d.brand} ${d.model}` }])
                  setQ("")
                }}
              >
                + {d.brand} {d.model}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type Stage = "photo" | "details" | "review-photo" | "done"

const QuickAddPage = () => {
  const queryClient = useQueryClient()
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)

  const [stage, setStage] = useState<Stage>("photo")
  const [preview, setPreview] = useState<string | null>(null)
  const [original, setOriginal] = useState<StoredFile | null>(null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [product, setProduct] = useState<CreatedProduct | null>(null)
  const [processed, setProcessed] = useState<ProcessResult | null>(null)

  // Display data: loaded on mount.
  const { data: aiStatus } = useQuery({
    queryKey: ["quick-add-status"],
    queryFn: () => sdk.client.fetch<QuickAddStatus>("/admin/quick-add/status"),
  })
  const { data: photoStatus } = useQuery(photoStatusQuery)
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["quick-add-categories"],
    queryFn: () =>
      sdk.admin.productCategory.list({ limit: 200, fields: "id,name,handle,parent_category.name" }),
  })

  useEffect(() => {
    headingRef.current?.focus()
  }, [stage])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const analyze = useMutation({
    mutationFn: (fileId: string) =>
      sdk.client.fetch<AnalyzeResponse>("/admin/quick-add/analyze", {
        method: "POST",
        body: { file_id: fileId },
        signal: AbortSignal.timeout(150_000),
      }),
    onSuccess: ({ suggestion }) => {
      setSuggestion(suggestion)
      setForm(fromSuggestion(suggestion))
    },
  })

  const upload = useMutation({
    mutationFn: uploadOriginal,
    onSuccess: (file) => {
      setOriginal(file)
      setStage("details")
      if (aiStatus?.ai_enabled) analyze.mutate(file.id)
    },
  })

  const onPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("This photo is larger than 25 MB. Take it again at a lower resolution.")
      return
    }
    setPreview(URL.createObjectURL(file))
    upload.mutate(file)
  }

  const create = useMutation({
    mutationFn: (body: CreateBody) =>
      sdk.client.fetch<{ product: CreatedProduct }>("/admin/quick-add", { method: "POST", body }),
    onSuccess: ({ product }) => {
      setProduct(product)
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success(`"${product.title}" saved as a draft`)
      if (original && photoStatus?.enabled) {
        setStage("review-photo")
        processPhotoMutation.mutate(original.id)
      } else {
        setStage("done")
      }
    },
  })

  const processPhotoMutation = useMutation({
    mutationFn: processPhoto,
    onSuccess: setProcessed,
  })

  const approve = useMutation({
    mutationFn: () => approvePhoto(product!.id, processed!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["product"] })
      toast.success("Photo added to the product")
      setStage("done")
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const price = toNumberOrNull(form.price)
    if (!form.title.trim()) return setFormError("Enter a title.")
    if (price === null || price <= 0) return setFormError("Enter the selling price in pounds, e.g. 12.99.")
    if (Math.abs(Math.round(price * 100) - price * 100) > 1e-6)
      return setFormError("Use at most 2 decimals for the price (e.g. 12.99).")
    const stock = form.stock.trim() === "" ? 0 : Number(form.stock)
    if (!Number.isInteger(stock) || stock < 0) return setFormError("Stock must be a whole number.")
    if (form.safety_marking !== "none" && !form.safety_marking_confirmed)
      return setFormError(`Check the ${form.safety_marking} mark on the label, then tick the box.`)

    create.mutate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      category_id: form.category_id || undefined,
      product_type: form.product_type || undefined,
      device_ids: form.devices.map((d) => d.id),
      price,
      sku: form.sku.trim() || undefined,
      stock,
      safety_marking: form.safety_marking,
      safety_marking_confirmed: form.safety_marking === "none" ? undefined : form.safety_marking_confirmed,
      attributes: {
        connector_a: form.connector_a.trim() || null,
        connector_b: form.connector_b.trim() || null,
        wattage: toNumberOrNull(form.wattage),
      },
      photo_file_id: original?.id,
      ai_assisted: Boolean(suggestion),
    })
  }

  const reset = () => {
    setStage("photo")
    setPreview(null)
    setOriginal(null)
    setSuggestion(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setProduct(null)
    setProcessed(null)
    ;[upload, analyze, create, processPhotoMutation, approve].forEach((m) => m.reset())
  }

  const selectedCategory = categories?.product_categories.find((c) => c.id === form.category_id)

  return (
    <Container className="divide-y p-0">
      <div ref={headingRef} tabIndex={-1} className="flex flex-col gap-y-2 px-4 py-4 outline-none md:px-6">
        <Heading level="h1">Quick add</Heading>
        <Text size="large" className="text-ui-fg-subtle">
          Take a photo of a product. We suggest the details, you check them, and it is saved as a
          draft. Nothing goes live until you publish it from the product page.
        </Text>
        {aiStatus && !aiStatus.ai_enabled && (
          <Alert variant="info">{ownerMessage(aiStatus.reason)}</Alert>
        )}
      </div>

      {stage === "photo" && (
        <div className="flex flex-col gap-3 px-4 py-4 md:px-6">
          <input
            ref={cameraInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={onPhoto}
          />
          <input
            ref={libraryInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={onPhoto}
          />
          <Button
            type="button"
            size="large"
            className="min-h-14 w-full text-base"
            onClick={() => cameraInput.current?.click()}
            isLoading={upload.isPending}
            disabled={upload.isPending}
          >
            <Camera /> Take photo
          </Button>
          <Button
            type="button"
            size="large"
            variant="secondary"
            className="min-h-11 w-full"
            onClick={() => libraryInput.current?.click()}
            disabled={upload.isPending}
          >
            Choose a photo
          </Button>
          <Button
            type="button"
            size="large"
            variant="transparent"
            className="min-h-11 w-full"
            onClick={() => setStage("details")}
            disabled={upload.isPending}
          >
            Add without a photo
          </Button>
          <Text size="large" className="text-ui-fg-subtle">
            Tip: product on a plain background, whole product in view, label readable.
          </Text>
          {upload.error && (
            <Alert variant="error" role="alert">
              {errorMessage(upload.error)}
            </Alert>
          )}
        </div>
      )}

      {stage === "details" && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-y-5 px-4 py-4 md:px-6">
          {preview && (
            <img
              src={preview}
              alt="Your product photo"
              className="bg-ui-bg-subtle mx-auto max-h-64 w-auto rounded-lg border object-contain"
            />
          )}

          {analyze.isPending && (
            <Alert variant="info" role="status">
              Reading the photo… this takes up to half a minute. You can start typing meanwhile.
            </Alert>
          )}
          {analyze.error && (
            <Alert variant="warning" role="alert">
              {errorMessage(analyze.error)}
            </Alert>
          )}
          {suggestion && (
            <div className="flex flex-col gap-y-2" aria-live="polite">
              <div className="flex flex-wrap items-center gap-2">
                <Badge color="purple">AI suggestion</Badge>
                <Badge color={suggestion.confidence === "high" ? "green" : "orange"}>
                  {`Confidence: ${suggestion.confidence}`}
                </Badge>
              </div>
              <Text size="large">
                Check every field. The AI can be wrong, especially about compatibility and the
                safety mark.
              </Text>
              {suggestion.warnings.map((w) => (
                <Alert key={w} variant="warning">
                  {w}
                </Alert>
              ))}
              {suggestion.notes && (
                <Text size="large" className="text-ui-fg-subtle">
                  To check: {suggestion.notes}
                </Text>
              )}
            </div>
          )}

          <Field id="qa-title" label="Title">
            <Input
              id="qa-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={120}
              className="min-h-11"
              required
            />
          </Field>

          <Field id="qa-description" label="Description (optional)">
            <Textarea
              id="qa-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={2000}
              rows={3}
            />
          </Field>

          <Field
            id="qa-price"
            label="Price (£, incl. VAT)"
            hint={
              suggestion?.suggested_price
                ? `Suggested: £${suggestion.suggested_price.amount.toFixed(2)} (an AI guess, not a rule).`
                : undefined
            }
          >
            <div className="flex flex-wrap gap-2">
              <Input
                id="qa-price"
                inputMode="decimal"
                placeholder="12.99"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                className="min-h-11 max-w-40"
                aria-describedby={suggestion?.suggested_price ? "qa-price-hint" : undefined}
                required
              />
              {suggestion?.suggested_price && (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => set("price", suggestion.suggested_price!.amount.toFixed(2))}
                >
                  Use £{suggestion.suggested_price.amount.toFixed(2)}
                </Button>
              )}
            </div>
          </Field>

          <Field id="qa-category" label="Category">
            <Select
              value={form.category_id || NONE}
              onValueChange={(v) => set("category_id", v === NONE ? "" : v)}
              disabled={categoriesLoading}
            >
              <Select.Trigger id="qa-category" className="min-h-11">
                <Select.Value placeholder="Choose a category" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={NONE}>No category</Select.Item>
                {categories?.product_categories.map((c) => (
                  <Select.Item key={c.id} value={c.id}>
                    {c.parent_category?.name ? `${c.parent_category.name} › ${c.name}` : c.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>

          <Field id="qa-type" label="Product type">
            <Select
              value={form.product_type || NONE}
              onValueChange={(v) => set("product_type", v === NONE ? "" : (v as ProductType))}
            >
              <Select.Trigger id="qa-type" className="min-h-11">
                <Select.Value placeholder="Choose a type" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={NONE}>Not set</Select.Item>
                {PRODUCT_TYPES.map(([value, label]) => (
                  <Select.Item key={value} value={value}>
                    {label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>

          <Field id="qa-devices" label="Fits these devices">
            <DevicePicker value={form.devices} onChange={(d) => set("devices", d)} />
          </Field>

          <fieldset className="flex flex-col gap-y-3 rounded-lg border p-4">
            <legend className="px-1">
              <Text size="large" weight="plus">
                Safety marking
              </Text>
            </legend>
            {suggestion && (
              <Text size="large" className="text-ui-fg-subtle">
                AI saw: {suggestion.safety_marking.guess === "none" ? "no mark" : suggestion.safety_marking.guess}
                {suggestion.safety_marking.evidence ? ` (${suggestion.safety_marking.evidence})` : ""}
              </Text>
            )}
            <RadioGroup
              value={form.safety_marking}
              onValueChange={(v) => {
                set("safety_marking", v as SafetyMarking)
                set("safety_marking_confirmed", false)
              }}
              className="flex flex-col gap-y-1"
            >
              {(["UKCA", "CE", "none"] as const).map((m) => (
                <label key={m} htmlFor={`qa-mark-${m}`} className="flex min-h-11 cursor-pointer items-center gap-x-3">
                  <RadioGroup.Item value={m} id={`qa-mark-${m}`} />
                  <Text size="large">{m === "none" ? "No mark" : m}</Text>
                </label>
              ))}
            </RadioGroup>
            {form.safety_marking !== "none" && (
              <label htmlFor="qa-mark-confirm" className="flex min-h-11 cursor-pointer items-center gap-x-3">
                <Checkbox
                  id="qa-mark-confirm"
                  checked={form.safety_marking_confirmed}
                  onCheckedChange={(v) => set("safety_marking_confirmed", v === true)}
                />
                <Text size="large" weight="plus">
                  I have checked the label: it shows the {form.safety_marking} mark
                </Text>
              </label>
            )}
            {(suggestion?.safety_marking.required_to_publish ||
              ["chargers-cables", "power-banks", "gaming-charging"].includes(selectedCategory?.handle ?? "")) &&
              form.safety_marking === "none" && (
                <Text size="large" className="text-ui-tag-orange-text">
                  Chargers and power products can be saved as a draft, but not published without a UKCA or CE mark.
                </Text>
              )}
          </fieldset>

          <details className="rounded-lg border p-4">
            <summary className="min-h-11 cursor-pointer py-2">
              <Text as="span" size="large" weight="plus">
                More details (SKU, stock, connectors)
              </Text>
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="qa-sku" label="SKU (optional)">
                <Input id="qa-sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} className="min-h-11" />
              </Field>
              <Field id="qa-stock" label="Stock in the shop">
                <Input
                  id="qa-stock"
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => set("stock", e.target.value)}
                  className="min-h-11"
                />
              </Field>
              <Field id="qa-connector-a" label="Connector A">
                <Input
                  id="qa-connector-a"
                  value={form.connector_a}
                  onChange={(e) => set("connector_a", e.target.value)}
                  placeholder="USB-C"
                  className="min-h-11"
                />
              </Field>
              <Field id="qa-connector-b" label="Connector B">
                <Input
                  id="qa-connector-b"
                  value={form.connector_b}
                  onChange={(e) => set("connector_b", e.target.value)}
                  placeholder="Lightning"
                  className="min-h-11"
                />
              </Field>
              <Field id="qa-wattage" label="Wattage (W)">
                <Input
                  id="qa-wattage"
                  inputMode="decimal"
                  value={form.wattage}
                  onChange={(e) => set("wattage", e.target.value)}
                  className="min-h-11"
                />
              </Field>
            </div>
          </details>

          {(formError || create.error) && (
            <Alert variant="error" role="alert">
              {formError ?? errorMessage(create.error)}
            </Alert>
          )}

          <div className="bg-ui-bg-base sticky bottom-0 flex flex-col gap-2 py-3 sm:flex-row">
            <Button
              type="submit"
              size="large"
              className="min-h-11 w-full sm:w-auto"
              isLoading={create.isPending}
              disabled={create.isPending || upload.isPending}
            >
              Save as draft
            </Button>
            <Button
              type="button"
              size="large"
              variant="secondary"
              className="min-h-11 w-full sm:w-auto"
              onClick={reset}
              disabled={create.isPending}
            >
              Start again
            </Button>
          </div>
        </form>
      )}

      {stage === "review-photo" && product && (
        <div className="flex flex-col gap-y-4 px-4 py-4 md:px-6">
          <Text size="large" weight="plus">
            Saved as a draft. Now the photo: we give it a clean white background. The product itself
            is never changed, and the original is kept.
          </Text>
          <PhotoCompare
            originalUrl={original?.url ?? preview}
            processedUrl={processed?.processed.url ?? null}
            placeholder={processPhotoMutation.isPending ? "Cleaning up the background…" : undefined}
          />
          {processPhotoMutation.isPending && (
            <Text size="large" className="text-ui-fg-subtle" role="status">
              Working on it… usually 5 to 15 seconds.
            </Text>
          )}
          {(processPhotoMutation.error || approve.error) && (
            <Alert variant="error" role="alert">
              {errorMessage(processPhotoMutation.error ?? approve.error)}
            </Alert>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            {processed ? (
              <Button
                type="button"
                size="large"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => approve.mutate()}
                isLoading={approve.isPending}
                disabled={approve.isPending}
              >
                Use this photo
              </Button>
            ) : (
              processPhotoMutation.error && (
                <Button
                  type="button"
                  size="large"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => original && processPhotoMutation.mutate(original.id)}
                >
                  Try again
                </Button>
              )
            )}
            <Button
              type="button"
              size="large"
              variant="secondary"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => setStage("done")}
              disabled={approve.isPending}
            >
              Skip for now
            </Button>
          </div>
        </div>
      )}

      {stage === "done" && product && (
        <div className="flex flex-col gap-y-3 px-4 py-4 md:px-6" aria-live="polite">
          <Alert variant="success">
            &ldquo;{product.title}&rdquo; is saved as a draft. Check it on the product page, then publish it
            there when it is ready.
          </Alert>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="large" className="min-h-11 w-full sm:w-auto">
              <Link to={`/products/${product.id}`}>Open product</Link>
            </Button>
            <Button type="button" size="large" variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={reset}>
              Add another product
            </Button>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Quick add",
  icon: Camera,
  rank: 2,
})

export default QuickAddPage
