import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Alert, Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChangeEvent, useRef, useState } from "react"
import { PhotoCompare } from "../components/photo-compare"
import { ownerMessage } from "../lib/today"
import {
  approvePhoto,
  errorMessage,
  photoStatusQuery,
  PhotoOriginalRecord,
  processPhoto,
  ProcessResult,
  QuickAddMetadata,
  StoredFile,
  uploadOriginal,
} from "../lib/photos"

const MAX_PHOTO_BYTES = 25 * 1024 * 1024

/**
 * Product photo: original next to the white-background version, with Process
 * and Approve (docs/contracts/photos.md). Only the background changes; the
 * original is always kept.
 */
const ProductPhotoWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<StoredFile | null>(null)
  const [result, setResult] = useState<ProcessResult | null>(null)

  const metadata = (product.metadata ?? {}) as Record<string, unknown>
  const approved = Array.isArray(metadata.photo_originals)
    ? (metadata.photo_originals as PhotoOriginalRecord[])
    : []
  const current = approved[approved.length - 1] ?? null
  const quickAdd = (metadata.quick_add ?? null) as QuickAddMetadata | null
  const pendingOriginal: StoredFile | null =
    quickAdd?.original_file_id && quickAdd.original_url
      ? { id: quickAdd.original_file_id, url: quickAdd.original_url }
      : null
  const pendingIsApproved = Boolean(
    pendingOriginal && approved.some((a) => a.original_file_id === pendingOriginal.id)
  )
  // What "Process" works on: a freshly chosen photo, else the Quick Add original not yet used.
  const toProcess = source ?? (pendingIsApproved ? null : pendingOriginal)

  // Display data: loads on mount.
  const { data: status, isLoading: statusLoading } = useQuery(photoStatusQuery)

  const processMutation = useMutation({
    mutationFn: (file: StoredFile) => processPhoto(file.id),
    onSuccess: setResult,
  })

  const uploadMutation = useMutation({
    mutationFn: uploadOriginal,
    onSuccess: (file) => {
      setSource(file)
      setResult(null)
      processMutation.mutate(file)
    },
  })

  const approveMutation = useMutation({
    mutationFn: (r: ProcessResult) => approvePhoto(product.id, r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["product", product.id] })
      toast.success("Photo approved: it is now the main image")
      setResult(null)
      setSource(null)
    },
  })

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("This photo is larger than 25 MB.")
      return
    }
    processMutation.reset()
    uploadMutation.mutate(file)
  }

  const busy = uploadMutation.isPending || processMutation.isPending || approveMutation.isPending
  const disabled = !status?.enabled
  const error = uploadMutation.error ?? processMutation.error ?? approveMutation.error

  const shownOriginal = result?.original.url ?? toProcess?.url ?? current?.original_url ?? null
  const shownProcessed = result?.processed.url ?? (toProcess ? null : current?.processed_url ?? null)

  let state: { label: string; color: "green" | "orange" | "blue" | "grey" }
  if (result) state = { label: "Waiting for approval", color: "blue" }
  else if (toProcess) state = { label: "Not processed", color: "orange" }
  else if (current) state = { label: "Approved", color: "green" }
  else state = { label: "No photo", color: "grey" }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-2 px-6 py-4">
        <Heading level="h2">Product photo</Heading>
        <Badge color={state.color} size="small">
          {state.label}
        </Badge>
      </div>

      <div className="flex flex-col gap-y-3 px-6 py-4">
        {statusLoading ? (
          <Text size="small" leading="compact" className="text-ui-fg-subtle" role="status">
            Checking the photo service…
          </Text>
        ) : (
          disabled && (
            <Alert variant="warning">
              {ownerMessage(status?.reason) ?? "Photo processing is not available right now."}
            </Alert>
          )
        )}

        <PhotoCompare
          originalUrl={shownOriginal}
          processedUrl={shownProcessed}
          placeholder={processMutation.isPending ? "Cleaning up the background…" : undefined}
        />

        {busy && (
          <Text size="small" leading="compact" className="text-ui-fg-subtle" role="status">
            {approveMutation.isPending
              ? "Saving…"
              : uploadMutation.isPending
                ? "Uploading the photo…"
                : "Working on it… usually 5 to 15 seconds."}
          </Text>
        )}
        {error && (
          <Alert variant="error" role="alert">
            {errorMessage(error)}
          </Alert>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={onFile}
        />
        <div className="flex flex-wrap gap-2">
          {result ? (
            <Button
              size="small"
              className="min-h-11"
              onClick={() => approveMutation.mutate(result)}
              isLoading={approveMutation.isPending}
              disabled={busy}
            >
              Approve
            </Button>
          ) : (
            toProcess && (
              <Button
                size="small"
                className="min-h-11"
                onClick={() => processMutation.mutate(toProcess)}
                isLoading={processMutation.isPending}
                disabled={busy || disabled}
              >
                Process
              </Button>
            )
          )}
          <Button
            size="small"
            variant="secondary"
            className="min-h-11"
            onClick={() => fileInput.current?.click()}
            disabled={busy || disabled}
          >
            {current || toProcess ? "New photo" : "Add photo"}
          </Button>
          {result && (
            <Button
              size="small"
              variant="transparent"
              className="min-h-11"
              onClick={() => setResult(null)}
              disabled={busy}
            >
              Discard
            </Button>
          )}
        </div>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Only the background is changed. The product is never altered and the original photo is
          always kept.
        </Text>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductPhotoWidget
