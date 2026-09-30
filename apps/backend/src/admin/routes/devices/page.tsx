import { defineRouteConfig } from "@medusajs/admin-sdk"
import { LaptopMobile, Plus, TriangleRightMini } from "@medusajs/icons"
import {
  Alert,
  Badge,
  Button,
  Container,
  Drawer,
  FocusModal,
  Heading,
  Input,
  Label,
  Text,
  clx,
  toast,
} from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ConfirmDialog, FilterChips, PageLoading, Pager, TAP, Thumb } from "../../components/shop-ui"
import { sdk } from "../../lib/client"
import { errorMessage, plural } from "../../lib/format"
import { DEVICE_TYPES, Device, DeviceListResponse, DeviceType, DeviceWithProducts } from "../../lib/types"
import { useDebounced } from "../../lib/use-debounced"
import {
  DeviceFormErrors,
  DeviceFormFields,
  DeviceFormValues,
  EMPTY_DEVICE_FORM,
  TYPE_LABELS,
  formFromDevice,
  toDeviceInput,
  validateDeviceForm,
} from "./device-form"

// Devices the shop sells accessories for (docs/contracts/devices.md).

const PAGE_SIZE = 50
type TypeFilter = DeviceType | "all"

function AddDeviceModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<DeviceFormValues>(EMPTY_DEVICE_FORM)
  const [errors, setErrors] = useState<DeviceFormErrors>({})

  const create = useMutation({
    mutationFn: (v: DeviceFormValues) =>
      sdk.client.fetch<{ device: Device }>("/admin/devices", {
        method: "POST",
        body: toDeviceInput(v),
      }),
    onSuccess: ({ device }) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] })
      toast.success(`${device.model} added.`)
      setValues(EMPTY_DEVICE_FORM)
      setErrors({})
      onOpenChange(false)
    },
  })

  const submit = () => {
    const found = validateDeviceForm(values)
    setErrors(found)
    if (Object.keys(found).length === 0) create.mutate(values)
  }

  return (
    <FocusModal
      open={open}
      onOpenChange={(o) => {
        if (!o) create.reset()
        onOpenChange(o)
      }}
    >
      <FocusModal.Content>
        <form
          className="flex h-full flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <FocusModal.Header>
            <FocusModal.Title asChild>
              <Heading level="h2">Add a device</Heading>
            </FocusModal.Title>
          </FocusModal.Header>
          <FocusModal.Body className="flex-1 overflow-auto">
            <div className="mx-auto flex w-full max-w-xl flex-col gap-y-5 px-4 py-6">
              <FocusModal.Description asChild>
                <Text size="large" className="text-ui-fg-subtle">
                  Customers pick their device in the shop to see what fits it.
                </Text>
              </FocusModal.Description>
              {create.isError && (
                <Alert variant="error" role="alert">
                  {errorMessage(create.error)}
                </Alert>
              )}
              <DeviceFormFields
                idPrefix="add-device"
                values={values}
                errors={errors}
                onChange={(v, field) => {
                  setValues(v)
                  setErrors({ ...errors, [field]: undefined })
                }}
              />
            </div>
          </FocusModal.Body>
          <FocusModal.Footer>
            <div className="flex w-full items-center justify-end gap-x-2">
              <FocusModal.Close asChild>
                <Button type="button" variant="secondary" className={TAP} disabled={create.isPending}>
                  Cancel
                </Button>
              </FocusModal.Close>
              <Button type="submit" className={TAP} isLoading={create.isPending}>
                Add device
              </Button>
            </div>
          </FocusModal.Footer>
        </form>
      </FocusModal.Content>
    </FocusModal>
  )
}

function EditDeviceDrawer({ device, onClose }: { device: Device | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<DeviceFormValues>(EMPTY_DEVICE_FORM)
  const [errors, setErrors] = useState<DeviceFormErrors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (device) {
      setValues(formFromDevice(device))
      setErrors({})
    }
  }, [device])

  // Products linked to this device: only needed while the drawer is open.
  const detail = useQuery({
    queryKey: ["devices", "detail", device?.id],
    queryFn: () =>
      sdk.client.fetch<{ device: DeviceWithProducts }>(`/admin/devices/${device!.id}`),
    enabled: !!device,
  })

  const update = useMutation({
    mutationFn: (v: DeviceFormValues) =>
      sdk.client.fetch<{ device: Device }>(`/admin/devices/${device!.id}`, {
        method: "POST",
        body: toDeviceInput(v),
      }),
    onSuccess: ({ device: saved }) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] })
      queryClient.invalidateQueries({ queryKey: ["product-devices"] })
      toast.success(`${saved.model} saved.`)
      onClose()
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/devices/${device!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] })
      queryClient.invalidateQueries({ queryKey: ["product-devices"] })
      toast.success(`${device?.model} deleted.`)
      onClose()
    },
  })

  const submit = () => {
    const found = validateDeviceForm(values)
    setErrors(found)
    if (Object.keys(found).length === 0) update.mutate(values)
  }

  const products = detail.data?.device.products ?? []
  const busy = update.isPending || remove.isPending
  const error = update.error ?? remove.error

  return (
    <Drawer
      open={!!device}
      onOpenChange={(o) => {
        if (!o) {
          update.reset()
          remove.reset()
          onClose()
        }
      }}
    >
      <Drawer.Content>
        <form
          className="flex h-full flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Drawer.Header>
            <Drawer.Title>Edit {device?.model}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-y-6 overflow-auto p-4">
            {error && (
              <Alert variant="error" role="alert">
                {errorMessage(error)}
              </Alert>
            )}
            <DeviceFormFields
              idPrefix="edit-device"
              values={values}
              errors={errors}
              isEdit
              onChange={(v, field) => {
                setValues(v)
                setErrors({ ...errors, [field]: undefined })
              }}
            />
            <section className="flex flex-col gap-y-2" aria-labelledby="edit-device-products">
              <Text id="edit-device-products" size="large" weight="plus">
                Products that fit
              </Text>
              {detail.isLoading ? (
                <PageLoading />
              ) : products.length === 0 ? (
                <Text size="large" className="text-ui-fg-subtle">
                  None yet. Link devices from a product's page.
                </Text>
              ) : (
                <ul className="flex flex-col gap-2">
                  {products.map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`/products/${p.id}`}
                        className="bg-ui-bg-component shadow-elevation-card-rest hover:bg-ui-bg-component-hover flex min-h-11 items-center gap-3 rounded-md px-3 py-2"
                      >
                        <Thumb src={p.thumbnail} />
                        <span className="flex flex-1 flex-col">
                          <Text as="span" size="large" weight="plus">
                            {p.title}
                          </Text>
                          {p.note && (
                            <Text as="span" size="large" className="text-ui-fg-subtle">
                              {p.note}
                            </Text>
                          )}
                        </span>
                        <TriangleRightMini className="text-ui-fg-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <div className="border-ui-border-base flex flex-col gap-y-2 border-t pt-4">
              <Text size="large" className="text-ui-fg-subtle">
                Deleting removes the device from the shop and from every product it is linked to.
              </Text>
              <Button
                type="button"
                variant="danger"
                className={clx(TAP, "self-start")}
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                isLoading={remove.isPending}
              >
                Delete device
              </Button>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex w-full items-center justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button type="button" variant="secondary" className={TAP} disabled={busy}>
                  Cancel
                </Button>
              </Drawer.Close>
              <Button type="submit" className={TAP} isLoading={update.isPending} disabled={busy}>
                Save
              </Button>
            </div>
          </Drawer.Footer>
        </form>
        <ConfirmDialog
          open={confirmDelete}
          variant="danger"
          title={`Delete ${device?.model}?`}
          description={
            products.length
              ? `It is linked to ${plural(products.length, "product")}. Those links are removed too. This can't be undone.`
              : "This can't be undone."
          }
          confirmText="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false)
            remove.mutate()
          }}
        />
      </Drawer.Content>
    </Drawer>
  )
}

const DevicesPage = () => {
  const [search, setSearch] = useState("")
  const [type, setType] = useState<TypeFilter>("all")
  const [offset, setOffset] = useState(0)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Device | null>(null)
  const q = useDebounced(search.trim())

  useEffect(() => setOffset(0), [q, type])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["devices", "list", q, type, offset],
    queryFn: () =>
      sdk.client.fetch<DeviceListResponse>("/admin/devices", {
        query: {
          limit: PAGE_SIZE,
          offset,
          order: "brand",
          ...(q ? { q } : {}),
          ...(type !== "all" ? { type } : {}),
        },
      }),
    placeholderData: keepPreviousData,
  })

  const devices = data?.devices ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-1">
          <Heading level="h1">Devices</Heading>
          <Text size="large" className="text-ui-fg-subtle">
            Phones, tablets, consoles and laptops customers can pick to see what fits.
          </Text>
        </div>
        <Button type="button" className={TAP} onClick={() => setAdding(true)}>
          <Plus />
          Add device
        </Button>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="device-search" size="base" weight="plus">
            Search
          </Label>
          <Input
            id="device-search"
            type="search"
            size="base"
            className="min-h-11 text-base"
            placeholder="Model, web address name or model number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <FilterChips<TypeFilter>
          label="Kind of device"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "All" },
            ...DEVICE_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
          ]}
        />
      </div>

      {isLoading ? (
        <PageLoading />
      ) : isError ? (
        <div className="px-4 py-4 md:px-6">
          <Alert variant="error" role="alert">
            {errorMessage(error)}
          </Alert>
        </div>
      ) : devices.length === 0 ? (
        <Text size="large" className="text-ui-fg-subtle px-4 py-6 md:px-6">
          {q || type !== "all" ? "No devices match." : "No devices yet. Press Add device."}
        </Text>
      ) : (
        <>
          <Text size="large" className="text-ui-fg-subtle px-4 py-3 md:px-6" aria-live="polite">
            {plural(data!.count, "device")}
          </Text>
          <ul className="divide-y" aria-label="Devices">
            {devices.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setEditing(d)}
                  className="hover:bg-ui-bg-base-hover focus-visible:shadow-borders-interactive-with-focus flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left outline-none md:px-6"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Text as="span" size="large" weight="plus">
                      {d.model}
                    </Text>
                    <Text as="span" size="large" className="text-ui-fg-subtle">
                      {d.brand} · {d.series}
                      {d.release_year ? ` · ${d.release_year}` : ""}
                    </Text>
                    {d.aliases.length > 0 && (
                      <Text as="span" size="small" className="text-ui-fg-muted truncate">
                        Also: {d.aliases.join(", ")}
                      </Text>
                    )}
                  </span>
                  <Badge size="small" color="grey">
                    {TYPE_LABELS[d.type]}
                  </Badge>
                  <TriangleRightMini className="text-ui-fg-muted" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <Pager offset={offset} limit={PAGE_SIZE} count={data!.count} onChange={setOffset} />
        </>
      )}

      <AddDeviceModal open={adding} onOpenChange={setAdding} />
      <EditDeviceDrawer device={editing} onClose={() => setEditing(null)} />
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Devices",
  icon: LaptopMobile,
})

export default DevicesPage
