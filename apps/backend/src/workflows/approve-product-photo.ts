import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateProductsWorkflow, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { resolvePhotoFilesStep } from "./steps/resolve-photo-files"

export type ApproveProductPhotoInput = {
  product_id: string
  processed_file_id: string
  original_file_id: string
  processed_avif_file_id?: string
  set_thumbnail?: boolean
}

export type PhotoOriginalRecord = {
  processed_file_id: string
  processed_url: string
  processed_avif_url: string | null
  original_file_id: string
  original_url: string
}

type ProductForPhoto = {
  id: string
  thumbnail: string | null
  images: { id: string; url: string }[] | null
  metadata: Record<string, unknown> | null
}

/** Pure: the product update that makes the processed photo the main image. */
export function buildPhotoApprovalUpdate(
  product: ProductForPhoto,
  files: {
    processed: { id: string; url: string }
    original: { id: string; url: string }
    processed_avif: { id: string; url: string } | null
  },
  setThumbnail: boolean
) {
  const others = (product.images ?? []).filter((i) => i.url !== files.processed.url)
  const existing = (product.images ?? []).find((i) => i.url === files.processed.url)
  const images = [
    existing ? { id: existing.id, url: existing.url } : { url: files.processed.url },
    ...others.map((i) => ({ id: i.id, url: i.url })),
  ]

  const metadata = product.metadata ?? {}
  const previous = Array.isArray(metadata.photo_originals)
    ? (metadata.photo_originals as PhotoOriginalRecord[])
    : []
  const record: PhotoOriginalRecord = {
    processed_file_id: files.processed.id,
    processed_url: files.processed.url,
    processed_avif_url: files.processed_avif?.url ?? null,
    original_file_id: files.original.id,
    original_url: files.original.url,
  }

  return {
    images,
    ...(setThumbnail ? { thumbnail: files.processed.url } : {}),
    metadata: {
      ...metadata,
      photo_originals: [
        ...previous.filter((r) => r.processed_file_id !== record.processed_file_id),
        record,
      ],
    },
  }
}

/**
 * Sets the processed photo as the product's first image (and thumbnail) and
 * records the original next to it in metadata. The original file is kept.
 * Rollback is handled by updateProductsWorkflow's own compensation.
 */
export const approveProductPhotoWorkflow = createWorkflow(
  "approve-product-photo",
  function (input: ApproveProductPhotoInput) {
    const { data: products } = useQueryGraphStep({
      entity: "product",
      fields: ["id", "thumbnail", "metadata", "images.id", "images.url"],
      filters: { id: input.product_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "get-product-for-photo" })

    const files = resolvePhotoFilesStep({
      processed_file_id: input.processed_file_id,
      original_file_id: input.original_file_id,
      processed_avif_file_id: input.processed_avif_file_id,
    })

    const updateInput = transform({ products, files, input }, ({ products, files, input }) => ({
      selector: { id: input.product_id },
      update: buildPhotoApprovalUpdate(
        products[0] as unknown as ProductForPhoto,
        files,
        input.set_thumbnail ?? true
      ),
    }))

    updateProductsWorkflow.runAsStep({ input: updateInput })

    const { data: updated } = useQueryGraphStep({
      entity: "product",
      fields: ["id", "thumbnail", "metadata", "images.id", "images.url", "images.rank"],
      filters: { id: input.product_id },
    }).config({ name: "get-product-after-photo" })

    const product = transform({ updated }, ({ updated }) => {
      const p = updated[0] as unknown as ProductForPhoto & { images: { id: string; url: string; rank?: number }[] }
      return {
        id: p.id,
        thumbnail: p.thumbnail,
        images: [...(p.images ?? [])]
          .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
          .map((i) => ({ id: i.id, url: i.url })),
        metadata: p.metadata,
      }
    })
    return new WorkflowResponse(product)
  }
)
