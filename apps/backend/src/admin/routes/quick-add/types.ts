/** Shapes from docs/contracts/quick-add.md. */

export const PRODUCT_TYPES = [
  ["case", "Case"],
  ["screen-protector", "Screen protector"],
  ["charger", "Charger"],
  ["cable", "Cable"],
  ["power-bank", "Power bank"],
  ["wireless-charger", "Wireless charger"],
  ["car-charger", "Car charger"],
  ["adapter", "Adapter"],
  ["earphones", "Earphones"],
  ["headphones", "Headphones"],
  ["speaker", "Speaker"],
  ["controller", "Controller"],
  ["gaming-headset", "Gaming headset"],
  ["gaming-accessory", "Gaming accessory"],
  ["keyboard-mouse", "Keyboard / mouse"],
  ["hub", "Hub"],
  ["memory-card", "Memory card"],
  ["mount-holder", "Mount / holder"],
  ["watch-strap", "Watch strap"],
  ["other", "Other"],
] as const
export type ProductType = (typeof PRODUCT_TYPES)[number][0]

export type SafetyMarking = "UKCA" | "CE" | "none"

export type QuickAddStatus = { ai_enabled: boolean; reason: string | null; model: string | null }

export type Suggestion = {
  is_product_photo: boolean
  title: string
  description: string
  category: { id: string; handle: string; name: string } | null
  product_type: ProductType
  devices: { id: string; slug: string; name: string }[]
  safety_marking: {
    guess: SafetyMarking
    evidence: string
    confirmed: false
    required_to_publish: boolean
  }
  suggested_price: { amount: number; currency_code: "gbp"; is_suggestion: true } | null
  attributes: {
    connector_a: string | null
    connector_b: string | null
    wattage: number | null
    cable_length_m: number | null
  }
  confidence: "low" | "medium" | "high"
  notes: string
  looks_like_vape: boolean
  warnings: string[]
}

export type AnalyzeResponse = {
  suggestion: Suggestion
  original: { id: string; url: string }
  model: string
}

export type CreateBody = {
  title: string
  description?: string
  category_id?: string
  product_type?: ProductType
  device_ids?: string[]
  price: number
  sku?: string
  stock?: number
  safety_marking: SafetyMarking
  safety_marking_confirmed?: boolean
  attributes?: {
    connector_a?: string | null
    connector_b?: string | null
    wattage?: number | null
    cable_length_m?: number | null
  }
  photo_file_id?: string
  ai_assisted?: boolean
}

export type CreatedProduct = {
  id: string
  title: string
  handle: string
  status: string
  metadata: { quick_add?: { original_file_id?: string | null; original_url?: string | null } } | null
}

export type DeviceOption = { id: string; slug: string; brand: string; model: string }
