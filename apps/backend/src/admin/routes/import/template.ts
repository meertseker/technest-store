/**
 * The downloadable CSV template: the header plus three example rows.
 * Kept in sync with the importer by src/lib/product-import/__tests__/template.unit.spec.ts.
 */
export const IMPORT_TEMPLATE_FILENAME = "tech-nest-import-template.csv"

export const IMPORT_TEMPLATE_CSV = [
  "sku,title,handle,description,category,price_gbp,status,stock,reorder_level,device_slugs,connector_a,connector_b,wattage,cable_length_m,platform,is_addon_item,safety_marking,warranty_months",
  'TN-CASE-IP16-CLR,Clear Shockproof Case iPhone 16,,"Slim, clear case with raised edges.",cases,6.99,published,15,3,iphone-16,,,,,,no,,6',
  "TN-CBL-CC-1M,USB-C to USB-C Cable 1m,,Braided 60W cable.,chargers-cables,4.99,published,40,10,,USB-C,USB-C,60,1,,no,UKCA,12",
  "TN-ADD-GRIP,Phone Grip Ring,,Stick-on metal ring grip.,1-deals,1.00,published,100,20,,,,,,,yes,,",
].join("\r\n") + "\r\n"
