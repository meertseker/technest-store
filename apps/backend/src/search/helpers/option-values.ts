export type ProductVariantRow = {
  deleted_at?: string | Date | null;
  options?:
    | ({
        value?: string | null;
        option?: { title?: string | null } | null;
      } | null)[]
    | null;
} | null;

/**
 * Flattens the option values a product's own variants use into
 * `"<option title>:<value>"` entries, e.g. `["Colour:Clear", "Model:iPhone 15"]`.
 * One field keeps the index simple; the storefront splits on the first `:` to
 * group the facet by option name.
 *
 * Options are shared across products in Medusa 2.21 (the seed has one "Model"
 * option holding every model), so `product.options.values` lists every model
 * in the shop. Only the variants say which ones this product comes in.
 * Soft-deleted variants (read by the index's catch-up pass) don't count.
 */
export function toOptionValues(
  variants: ProductVariantRow[] | null | undefined,
): string[] {
  const flattened = (variants ?? []).flatMap((variant) => {
    if (!variant || variant.deleted_at) {
      return [];
    }

    return (variant.options ?? []).flatMap((optionValue) => {
      const title = optionValue?.option?.title?.trim();
      const value = optionValue?.value?.trim();
      return title && value ? [`${title}:${value}`] : [];
    });
  });

  // Every variant repeats the values it shares with its siblings.
  return Array.from(new Set(flattened));
}
