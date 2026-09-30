export const DEVICE_EVENTS = {
  /**
   * The devices a product fits changed: a link was added, re-noted or removed,
   * or a linked device was renamed or deleted. Payload `{ id: <product id> }`,
   * one message per product. Internal: the product search index re-reads
   * those products (src/search/product.ts). Link changes emit no core event.
   */
  PRODUCT_DEVICES_CHANGED: "technest.product.devices_changed",
} as const
