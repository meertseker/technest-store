import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import { TAP } from "../../../components/shop-ui"
import { sdk } from "../../../lib/client"
import { formatPence, penceToPoundsInput, poundsInputToPence } from "../../../lib/pence"

/** docs/contracts/settings.md (v1): integer pence. */
type TechnestSettings = {
  free_delivery_threshold_pence: number
  klarna_min_basket_pence: number
}
type SettingsResponse = { settings: TechnestSettings }
type Key = keyof TechnestSettings

const QUERY_KEY = ["technest-settings"]
/** £1000, the API's upper bound. */
const MAX_PENCE = 100000

const FIELDS: { key: Key; label: string; help: string }[] = [
  {
    key: "free_delivery_threshold_pence",
    label: "Free Standard delivery from",
    help: "Baskets at or above this (inc. VAT) get Standard delivery for £0. Next-day is never free; Click & Collect is always free.",
  },
  {
    key: "klarna_min_basket_pence",
    label: "Klarna from",
    help: "Klarna is offered at checkout only at or above this basket total.",
  },
]

function EditDrawer({
  settings,
  open,
  onOpenChange,
}: {
  settings: TechnestSettings
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Record<Key, string>>({
    free_delivery_threshold_pence: penceToPoundsInput(settings.free_delivery_threshold_pence),
    klarna_min_basket_pence: penceToPoundsInput(settings.klarna_min_basket_pence),
  })
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({})

  const save = useMutation({
    mutationFn: (body: Partial<TechnestSettings>) =>
      sdk.client.fetch<SettingsResponse>("/admin/technest-settings", {
        method: "POST",
        body,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data)
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success("Settings saved")
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error("Couldn't save the settings", { description: error.message })
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const body: Partial<TechnestSettings> = {}
    const nextErrors: Partial<Record<Key, string>> = {}
    for (const { key } of FIELDS) {
      const pence = poundsInputToPence(values[key])
      if (pence === null || pence > MAX_PENCE) {
        nextErrors[key] = "Enter an amount between £0.00 and £1,000.00, e.g. 20.00"
      } else if (pence !== settings[key]) {
        body[key] = pence
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      return
    }
    if (!Object.keys(body).length) {
      onOpenChange(false)
      return
    }
    save.mutate(body)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <form onSubmit={onSubmit} className="flex h-full flex-col" noValidate>
          <Drawer.Header>
            <Drawer.Title>Edit delivery and payment settings</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-y-6 overflow-auto p-4">
            {FIELDS.map(({ key, label, help }) => (
              <div key={key} className="flex flex-col gap-y-2">
                <Label htmlFor={key} weight="plus">
                  {label} (£)
                </Label>
                <Input
                  id={key}
                  inputMode="decimal"
                  autoComplete="off"
                  value={values[key]}
                  aria-invalid={!!errors[key]}
                  aria-describedby={`${key}-help${errors[key] ? ` ${key}-error` : ""}`}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                />
                <Text id={`${key}-help`} size="large" className="text-ui-fg-subtle">
                  {help}
                </Text>
                {errors[key] && (
                  <Text id={`${key}-error`} size="large" className="text-ui-fg-error" role="alert">
                    {errors[key]}
                  </Text>
                )}
              </div>
            ))}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary" type="button" className={TAP} disabled={save.isPending}>
                Cancel
              </Button>
            </Drawer.Close>
            <Button type="submit" className={TAP} isLoading={save.isPending} disabled={save.isPending}>
              Save
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}

const TechnestSettingsPage = () => {
  const [open, setOpen] = useState(false)
  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => sdk.client.fetch<SettingsResponse>("/admin/technest-settings"),
  })

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-y-1">
          <Heading level="h1">Shop settings</Heading>
          <Text size="large" className="text-ui-fg-subtle">
            The basket amounts for free delivery and for Klarna. Amounts include VAT.
          </Text>
        </div>
        <Button
          variant="secondary"
          className={TAP}
          onClick={() => setOpen(true)}
          disabled={!data}
        >
          Edit
        </Button>
      </div>
      {isLoading && (
        <div className="px-4 py-4 md:px-6">
          <Text size="large" className="text-ui-fg-subtle" role="status">
            Loading…
          </Text>
        </div>
      )}
      {isError && (
        <div className="px-4 py-4 md:px-6">
          <Text size="large" className="text-ui-fg-error" role="alert">
            Couldn't load the settings. Refresh the page to try again.
          </Text>
        </div>
      )}
      {data &&
        FIELDS.map(({ key, label, help }) => (
          <div key={key} className="grid grid-cols-1 gap-2 px-4 py-4 md:grid-cols-2 md:px-6">
            <div className="flex flex-col gap-y-1">
              <Text size="large" weight="plus">
                {label}
              </Text>
              <Text size="large" className="text-ui-fg-subtle">
                {help}
              </Text>
            </div>
            <Text size="large" weight="plus" className="md:text-right">
              {formatPence(data.settings[key])}
            </Text>
          </div>
        ))}
      {data && open && (
        <EditDrawer settings={data.settings} open={open} onOpenChange={setOpen} />
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Shop settings",
})

export default TechnestSettingsPage
