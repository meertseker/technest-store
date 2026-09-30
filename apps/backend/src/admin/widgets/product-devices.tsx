import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Plus } from "@medusajs/icons"
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Container,
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
import { PageLoading, Pager, TAP } from "../components/shop-ui"
import { sdk } from "../lib/client"
import { errorMessage, plural } from "../lib/format"
import type { DeviceListResponse, LinkedDevice } from "../lib/types"
import { useDebounced } from "../lib/use-debounced"

// "Fits these devices" on the product page (docs/contracts/devices.md,
// GET/POST /admin/products/:id/devices).

const PICK_PAGE_SIZE = 30

type SetDevicesBody = {
  add?: { device_id: string; note: string | null }[]
  remove?: string[]
}

const ProductDevicesWidget = ({ data: product }: DetailWidgetProps<HttpTypes.AdminProduct>) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState("")
  const q = useDebounced(search.trim())
  const displayKey = ["product-devices", product.id]

  useEffect(() => setOffset(0), [q])

  // Display query: loads on mount.
  const linked = useQuery({
    queryKey: displayKey,
    queryFn: () =>
      sdk.client.fetch<{ devices: LinkedDevice[] }>(`/admin/products/${product.id}/devices`),
  })

  // Picker query: only while the modal is open.
  const picker = useQuery({
    queryKey: ["devices", "picker", q, offset],
    queryFn: () =>
      sdk.client.fetch<DeviceListResponse>("/admin/devices", {
        query: { limit: PICK_PAGE_SIZE, offset, order: "brand", ...(q ? { q } : {}) },
      }),
    enabled: open,
    placeholderData: keepPreviousData,
  })

  const save = useMutation({
    mutationFn: (body: SetDevicesBody) =>
      sdk.client.fetch<{ devices: LinkedDevice[] }>(`/admin/products/${product.id}/devices`, {
        method: "POST",
        body,
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(displayKey, res)
      queryClient.invalidateQueries({ queryKey: displayKey })
      queryClient.invalidateQueries({ queryKey: ["devices", "detail"] })
    },
  })

  const closeModal = () => {
    setOpen(false)
    setSelected(new Set())
    setNote("")
    setSearch("")
    save.reset()
  }

  const addSelected = () => {
    const trimmed = note.trim()
    save.mutate(
      { add: [...selected].map((id) => ({ device_id: id, note: trimmed || null })) },
      {
        onSuccess: () => {
          toast.success(`${plural(selected.size, "device")} linked.`)
          closeModal()
        },
      }
    )
  }

  const unlink = (d: LinkedDevice) =>
    save.mutate(
      { remove: [d.id] },
      {
        onSuccess: () => toast.success(`${d.model} removed.`),
        onError: (e) => toast.error(errorMessage(e)),
      }
    )

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected)
    if (on) next.add(id)
    else next.delete(id)
    setSelected(next)
  }

  const devices = linked.data?.devices ?? []
  const linkedIds = new Set(devices.map((d) => d.id))
  const options = picker.data?.devices ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-2 px-6 py-4">
        <Heading level="h2">Fits these devices</Heading>
        <Button
          type="button"
          size="small"
          variant="secondary"
          className={TAP}
          onClick={() => setOpen(true)}
        >
          <Plus />
          Add
        </Button>
      </div>
      <div className="px-6 py-4">
        {linked.isLoading ? (
          <PageLoading />
        ) : linked.isError ? (
          <Alert variant="error">{errorMessage(linked.error)}</Alert>
        ) : devices.length === 0 ? (
          <Text size="large" className="text-ui-fg-subtle">
            No devices linked. Customers won't see this product when they pick a device.
          </Text>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Linked devices">
            {devices.map((d) => (
              <li
                key={d.id}
                className="bg-ui-bg-component shadow-elevation-card-rest flex items-center gap-3 rounded-md px-3 py-2"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <Text size="large" weight="plus">
                    {d.model}
                  </Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    {d.brand} · {d.series}
                  </Text>
                  {d.note && (
                    <Text size="small" className="text-ui-fg-subtle italic">
                      {d.note}
                    </Text>
                  )}
                </div>
                <Button
                  type="button"
                  size="small"
                  variant="transparent"
                  className={TAP}
                  aria-label={`Remove ${d.model}`}
                  onClick={() => unlink(d)}
                  disabled={save.isPending}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FocusModal open={open} onOpenChange={(o) => (o ? setOpen(true) : closeModal())}>
        <FocusModal.Content>
          <div className="flex h-full flex-col overflow-hidden">
            <FocusModal.Header>
              <FocusModal.Title asChild>
                <Heading level="h2">Link devices to {product.title}</Heading>
              </FocusModal.Title>
            </FocusModal.Header>
            <FocusModal.Body className="flex-1 overflow-auto">
              <div className="mx-auto flex w-full max-w-xl flex-col gap-y-4 px-4 py-6">
                <FocusModal.Description asChild>
                  <Text size="large" className="text-ui-fg-subtle">
                    Tick every device this product fits. Picking a device that is already linked
                    replaces its note.
                  </Text>
                </FocusModal.Description>
                {save.isError && (
                  <Alert variant="error" role="alert">
                    {errorMessage(save.error)}
                  </Alert>
                )}
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="link-device-search" size="base" weight="plus">
                    Search devices
                  </Label>
                  <Input
                    id="link-device-search"
                    type="search"
                    className="min-h-11 text-base"
                    placeholder="e.g. iPhone 16 or A3102"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {picker.isLoading ? (
                  <PageLoading />
                ) : picker.isError ? (
                  <Alert variant="error">{errorMessage(picker.error)}</Alert>
                ) : options.length === 0 ? (
                  <Text size="large" className="text-ui-fg-subtle">
                    No devices match. Add new ones under Devices.
                  </Text>
                ) : (
                  <ul className="divide-y rounded-md border" aria-label="Devices to link">
                    {options.map((d) => {
                      const id = `link-device-${d.id}`
                      return (
                        <li key={d.id}>
                          <label
                            htmlFor={id}
                            className={clx(
                              "hover:bg-ui-bg-base-hover flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2"
                            )}
                          >
                            <Checkbox
                              id={id}
                              checked={selected.has(d.id)}
                              onCheckedChange={(c) => toggle(d.id, c === true)}
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <Text as="span" size="large" weight="plus">
                                {d.model}
                              </Text>
                              <Text as="span" size="small" className="text-ui-fg-subtle">
                                {d.brand} · {d.series}
                              </Text>
                            </span>
                            {linkedIds.has(d.id) && (
                              <Badge size="small" color="green">
                                Linked
                              </Badge>
                            )}
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {picker.data && (
                  <Pager
                    offset={offset}
                    limit={PICK_PAGE_SIZE}
                    count={picker.data.count}
                    onChange={setOffset}
                  />
                )}
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="link-device-note" size="base" weight="plus">
                    Note for customers (optional)
                  </Label>
                  <Text size="large" id="link-device-note-hint" className="text-ui-fg-subtle">
                    Shown next to the device, e.g. "Not compatible with MagSafe". Up to 200
                    characters.
                  </Text>
                  <Input
                    id="link-device-note"
                    className="min-h-11 text-base"
                    maxLength={200}
                    aria-describedby="link-device-note-hint"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
            </FocusModal.Body>
            <FocusModal.Footer>
              <div className="flex w-full items-center justify-end gap-x-2">
                <Button
                  type="button"
                  variant="secondary"
                  className={TAP}
                  onClick={closeModal}
                  disabled={save.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className={TAP}
                  onClick={addSelected}
                  disabled={selected.size === 0 || save.isPending}
                  isLoading={save.isPending}
                >
                  {selected.size ? `Link ${plural(selected.size, "device")}` : "Link devices"}
                </Button>
              </div>
            </FocusModal.Footer>
          </div>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side",
})

export default ProductDevicesWidget
