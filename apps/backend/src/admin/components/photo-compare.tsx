import { Text } from "@medusajs/ui"

type Props = {
  originalUrl: string | null
  processedUrl: string | null
  /** Shown in the processed slot while there is nothing yet. */
  placeholder?: string
}

/** Original next to the cleaned-up photo (stacked on a phone). */
export const PhotoCompare = ({ originalUrl, processedUrl, placeholder }: Props) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <figure className="flex flex-col gap-y-1">
      <div className="bg-ui-bg-subtle flex aspect-square items-center justify-center overflow-hidden rounded-lg border">
        {originalUrl ? (
          <img src={originalUrl} alt="Original photo" className="h-full w-full object-contain" />
        ) : (
          <Text size="small" className="text-ui-fg-muted">
            No original
          </Text>
        )}
      </div>
      <figcaption>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Original (always kept)
        </Text>
      </figcaption>
    </figure>
    <figure className="flex flex-col gap-y-1">
      <div className="bg-ui-bg-subtle flex aspect-square items-center justify-center overflow-hidden rounded-lg border">
        {processedUrl ? (
          <img src={processedUrl} alt="Photo with white background" className="h-full w-full object-contain" />
        ) : (
          <Text size="small" className="text-ui-fg-muted px-4 text-center">
            {placeholder ?? "Not processed yet"}
          </Text>
        )}
      </div>
      <figcaption>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          White background (only the background changes)
        </Text>
      </figcaption>
    </figure>
  </div>
)
