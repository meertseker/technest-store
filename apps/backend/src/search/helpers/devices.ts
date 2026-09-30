export type LinkedDeviceRow = {
  brand?: string | null;
  series?: string | null;
  model?: string | null;
  aliases?: (string | null)[] | null;
  deleted_at?: string | Date | null;
} | null;

/**
 * The words a product is findable by through the devices it's linked to
 * (product-device link, docs/contracts/devices.md): brand, series, model and
 * aliases (short names and model numbers such as "a3090"), deduplicated in
 * that order. Soft-deleted devices (read by the catch-up pass) don't count.
 */
export function toDeviceTerms(
  devices: LinkedDeviceRow[] | null | undefined,
): string[] {
  const terms = (devices ?? []).flatMap((device) => {
    if (!device || device.deleted_at) {
      return [];
    }

    return [device.brand, device.series, device.model, ...(device.aliases ?? [])]
      .map((term) => term?.trim())
      .filter((term): term is string => Boolean(term));
  });

  return Array.from(new Set(terms));
}
