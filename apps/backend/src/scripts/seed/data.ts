/**
 * Tech Nest seed data: store configuration, categories and sample products.
 *
 * Medusa prices are major units (GBP 3.49 is 3.49), VAT inclusive.
 * Product attributes go to the productAttributes module (ADR 0001).
 */

import { ProductAttributesValues } from "../../modules/product-attributes/utils"

export const SHOP = {
  storeName: "Tech Nest",
  locationName: "Tech Nest – Southwark Park Rd",
  address: {
    address_1: "Unit 2A, Southwark Park Rd.",
    city: "London",
    postal_code: "SE16 3TU",
    country_code: "GB",
    phone: "07775 669000",
  },
}

export const REGION = {
  name: "United Kingdom",
  currency_code: "gbp",
  countries: ["gb"],
  vat_rate: 20,
}

/** Placeholder delivery prices; the lead will confirm real ones. */
export const SHIPPING = {
  clickCollect: {
    name: "Click & Collect – Free in-store pickup",
    code: "click-collect",
    label: "Click & Collect",
    description: "Free. Collect from the shop in Southwark Park Rd, usually same day.",
    amount: 0,
  },
  standard: {
    name: "Standard delivery",
    code: "standard",
    label: "Standard",
    description: "Royal Mail, 2-3 working days.",
    amount: 3.49,
  },
  nextDay: {
    name: "Next-day delivery",
    code: "next-day",
    label: "Next-day",
    description: "Order by 3pm Mon-Fri for next working day.",
    amount: 5.99,
  },
}

export type CategorySeed = {
  name: string
  handle: string
  children?: { name: string; handle: string }[]
}

export const CATEGORIES: CategorySeed[] = [
  {
    name: "Phone Accessories",
    handle: "phone-accessories",
    children: [
      { name: "Cases", handle: "cases" },
      { name: "Screen Protectors", handle: "screen-protectors" },
      { name: "Chargers & Cables", handle: "chargers-cables" },
      { name: "Power Banks", handle: "power-banks" },
    ],
  },
  {
    name: "Audio",
    handle: "audio",
    children: [
      { name: "Earphones", handle: "earphones" },
      { name: "Headphones", handle: "headphones" },
      { name: "Speakers", handle: "speakers" },
    ],
  },
  {
    name: "Gaming",
    handle: "gaming",
    children: [
      { name: "Controllers", handle: "controllers" },
      { name: "Headsets", handle: "gaming-headsets" },
      { name: "Charging", handle: "gaming-charging" },
    ],
  },
  {
    name: "Computer & Laptop",
    handle: "computer-laptop",
    children: [
      { name: "Cooling Pads", handle: "cooling-pads" },
      { name: "Keyboards & Mice", handle: "keyboards-mice" },
      { name: "Hubs & Adapters", handle: "hubs-adapters" },
    ],
  },
  { name: "£1 Deals", handle: "1-deals" },
]

/** Shared (non-exclusive) product options and every value the seed uses. */
export const OPTIONS = {
  Colour: ["Black", "White", "Clear", "Blue", "Pink", "Brown", "Grey", "Red"],
  Model: [
    "iPhone 13",
    "iPhone 14",
    "iPhone 15",
    "iPhone 15 Pro",
    "iPhone 16",
    "iPhone 16 Pro",
    "iPhone 16 Pro Max",
    "Galaxy S24",
    "Galaxy S25 Ultra",
    "Galaxy A15",
    "Galaxy A55",
  ],
  Length: ["1m", "2m"],
}

type OptionTitle = keyof typeof OPTIONS

/** Seed attributes: everything except reorder_level (see ProductSeed). */
export type ProductAttributes = Partial<Omit<ProductAttributesValues, "reorder_level">>

export type ProductSeed = {
  title: string
  handle: string
  category: string
  description: string
  /** Default price for every variant, GBP inc. VAT. */
  price: number
  /** Option axes; variants are their cartesian product. */
  options: Partial<Record<OptionTitle, string[]>>
  /** Per-variant price overrides keyed by an option value (e.g. "2m"). */
  priceByValue?: Record<string, number>
  attributes?: ProductAttributes
  /** Stocked quantity per variant at the shop. */
  stock: number
  /** Low-stock threshold, applied to each variant (product attribute). */
  reorder_level: number
  weight: number
}

const IPHONES_RECENT = ["iPhone 15", "iPhone 16"]

export const PRODUCTS: ProductSeed[] = [
  // ---- Cases -------------------------------------------------------------
  {
    title: "Clear Shockproof Case",
    handle: "clear-shockproof-case",
    category: "cases",
    description:
      "Slim, crystal-clear case with reinforced corners that absorb drops. Anti-yellowing TPU, raised lip protects the screen and camera.",
    price: 6.99,
    options: {
      Colour: ["Clear"],
      Model: ["iPhone 13", "iPhone 14", "iPhone 15", "iPhone 16", "iPhone 16 Pro"],
    },
    attributes: { warranty_months: 6 },
    stock: 25,
    reorder_level: 5,
    weight: 40,
  },
  {
    title: "Silicone Case with MagSafe",
    handle: "silicone-case-magsafe",
    category: "cases",
    description:
      "Soft-touch silicone with a microfibre lining and built-in magnets for MagSafe chargers and mounts.",
    price: 9.99,
    options: { Colour: ["Black", "Pink", "Blue"], Model: IPHONES_RECENT },
    attributes: { warranty_months: 6 },
    stock: 12,
    reorder_level: 4,
    weight: 45,
  },
  {
    title: "Leather Wallet Case",
    handle: "leather-wallet-case",
    category: "cases",
    description:
      "PU leather flip case with three card slots, a cash pocket and a magnetic clasp. Folds into a viewing stand.",
    price: 11.99,
    options: { Colour: ["Black", "Brown"], Model: ["Galaxy S24", "Galaxy A55"] },
    attributes: { warranty_months: 6 },
    stock: 8,
    reorder_level: 3,
    weight: 80,
  },
  {
    title: "Rugged Armour Case",
    handle: "rugged-armour-case",
    category: "cases",
    description:
      "Dual-layer heavy-duty case with a built-in kickstand. Tested to 3m drops.",
    price: 12.99,
    options: { Colour: ["Black"], Model: ["iPhone 16 Pro Max", "Galaxy S25 Ultra"] },
    attributes: { warranty_months: 12 },
    stock: 6,
    reorder_level: 3,
    weight: 95,
  },

  // ---- Screen protectors -------------------------------------------------
  {
    title: "Tempered Glass Screen Protector (2-pack)",
    handle: "tempered-glass-screen-protector-2-pack",
    category: "screen-protectors",
    description:
      "9H tempered glass, bubble-free fit with an alignment frame. Two protectors in the box. We can fit it for free in the shop.",
    price: 4.99,
    options: {
      Colour: ["Clear"],
      Model: ["iPhone 14", "iPhone 15", "iPhone 16", "Galaxy A15"],
    },
    stock: 40,
    reorder_level: 10,
    weight: 60,
  },
  {
    title: "Privacy Glass Screen Protector",
    handle: "privacy-glass-screen-protector",
    category: "screen-protectors",
    description:
      "Anti-spy tempered glass: the screen is clear straight on and dark from the side.",
    price: 7.99,
    options: { Colour: ["Black"], Model: ["iPhone 15 Pro", "iPhone 16 Pro"] },
    stock: 15,
    reorder_level: 4,
    weight: 40,
  },
  {
    title: "Camera Lens Protector",
    handle: "camera-lens-protector",
    category: "screen-protectors",
    description:
      "Individual tempered-glass rings for each lens. Doesn't affect photo quality or flash.",
    price: 3.99,
    options: { Colour: ["Clear"], Model: ["iPhone 15 Pro", "iPhone 16 Pro"] },
    stock: 2,
    reorder_level: 5,
    weight: 20,
  },

  // ---- Chargers & cables (safety_marking required) -----------------------
  {
    title: "20W USB-C Fast Wall Charger",
    handle: "20w-usb-c-fast-wall-charger",
    category: "chargers-cables",
    description:
      "UK 3-pin plug with one USB-C PD port. Charges an iPhone 16 to 50% in about 30 minutes.",
    price: 9.99,
    options: { Colour: ["White"] },
    attributes: {
      safety_marking: "UKCA",
      connector_a: "UK plug",
      connector_b: "USB-C",
      wattage: 20,
      warranty_months: 12,
    },
    stock: 30,
    reorder_level: 8,
    weight: 70,
  },
  {
    title: "35W Dual USB-C Wall Charger",
    handle: "35w-dual-usb-c-wall-charger",
    category: "chargers-cables",
    description:
      "Two USB-C ports sharing 35W. Charge a phone and earbuds at the same time.",
    price: 16.99,
    options: { Colour: ["White"] },
    attributes: {
      safety_marking: "UKCA",
      connector_a: "UK plug",
      connector_b: "USB-C",
      wattage: 35,
      warranty_months: 12,
    },
    stock: 10,
    reorder_level: 3,
    weight: 90,
  },
  {
    title: "65W GaN Laptop Charger",
    handle: "65w-gan-laptop-charger",
    category: "chargers-cables",
    description:
      "Compact GaN charger with USB-C PD up to 65W. Powers most USB-C laptops, tablets and phones.",
    price: 29.99,
    options: { Colour: ["Black"] },
    attributes: {
      safety_marking: "CE",
      connector_a: "UK plug",
      connector_b: "USB-C",
      wattage: 65,
      warranty_months: 12,
    },
    stock: 5,
    reorder_level: 2,
    weight: 120,
  },
  {
    title: "USB-C to Lightning Cable",
    handle: "usb-c-to-lightning-cable",
    category: "chargers-cables",
    description:
      "MFi-certified braided cable for fast charging iPhone 14 and earlier.",
    price: 6.99,
    priceByValue: { "2m": 8.99 },
    options: { Colour: ["White"], Length: ["1m", "2m"] },
    attributes: {
      safety_marking: "CE",
      connector_a: "USB-C",
      connector_b: "Lightning",
      warranty_months: 6,
    },
    stock: 35,
    reorder_level: 10,
    weight: 30,
  },
  {
    title: "USB-C to USB-C Braided Cable 60W",
    handle: "usb-c-to-usb-c-braided-cable-60w",
    category: "chargers-cables",
    description:
      "Nylon-braided 60W cable for iPhone 15/16, Samsung, Pixel, iPad and laptops.",
    price: 5.99,
    priceByValue: { "2m": 7.99 },
    options: { Colour: ["Black", "White"], Length: ["1m", "2m"] },
    attributes: {
      safety_marking: "CE",
      connector_a: "USB-C",
      connector_b: "USB-C",
      wattage: 60,
      warranty_months: 6,
    },
    stock: 50,
    reorder_level: 10,
    weight: 30,
  },
  {
    title: "Dual USB-C Car Charger 38W",
    handle: "dual-usb-c-car-charger-38w",
    category: "chargers-cables",
    description: "12/24V car socket charger with USB-C PD and USB-A Quick Charge ports.",
    price: 11.99,
    options: { Colour: ["Black"] },
    attributes: {
      safety_marking: "UKCA",
      connector_a: "12V socket",
      connector_b: "USB-C",
      wattage: 38,
      warranty_months: 12,
    },
    stock: 9,
    reorder_level: 3,
    weight: 40,
  },
  {
    title: "15W Magnetic Wireless Charger",
    handle: "15w-magnetic-wireless-charger",
    category: "chargers-cables",
    description:
      "Snap-on magnetic charging pad for MagSafe iPhones and Qi phones with a magnetic case.",
    price: 14.99,
    options: { Colour: ["White"] },
    attributes: {
      safety_marking: "CE",
      connector_a: "USB-C",
      connector_b: "Qi",
      wattage: 15,
      warranty_months: 12,
    },
    stock: 7,
    reorder_level: 3,
    weight: 60,
  },

  // ---- Power banks (safety_marking required) -----------------------------
  {
    title: "10,000mAh Slim Power Bank 20W",
    handle: "10000mah-slim-power-bank-20w",
    category: "power-banks",
    description:
      "Pocket-sized power bank with USB-C PD in/out. Charges most phones two times.",
    price: 19.99,
    options: { Colour: ["Black", "White"] },
    attributes: {
      safety_marking: "UKCA",
      connector_a: "USB-C",
      connector_b: "USB-A",
      wattage: 20,
      warranty_months: 12,
    },
    stock: 14,
    reorder_level: 4,
    weight: 210,
  },
  {
    title: "20,000mAh Power Bank 22.5W",
    handle: "20000mah-power-bank-22-5w",
    category: "power-banks",
    description:
      "High-capacity power bank with LED display and three outputs. Four to five phone charges.",
    price: 27.99,
    options: { Colour: ["Black"] },
    attributes: {
      safety_marking: "UKCA",
      connector_a: "USB-C",
      connector_b: "USB-A",
      wattage: 22.5,
      warranty_months: 12,
    },
    stock: 3,
    reorder_level: 4,
    weight: 380,
  },
  {
    title: "5,000mAh Magnetic Power Bank",
    handle: "5000mah-magnetic-power-bank",
    category: "power-banks",
    description: "Clips magnetically to the back of MagSafe iPhones. No cable needed.",
    price: 17.99,
    options: { Colour: ["White", "Blue"] },
    attributes: {
      safety_marking: "CE",
      connector_a: "USB-C",
      connector_b: "Qi",
      wattage: 15,
      warranty_months: 12,
    },
    stock: 10,
    reorder_level: 3,
    weight: 130,
  },

  // ---- Audio ---------------------------------------------------------------
  {
    title: "True Wireless Earbuds",
    handle: "true-wireless-earbuds",
    category: "earphones",
    description:
      "Bluetooth 5.3 earbuds with touch controls, 6h playback and 24h more from the charging case.",
    price: 24.99,
    options: { Colour: ["Black", "White"] },
    attributes: { connector_a: "USB-C", warranty_months: 12 },
    stock: 12,
    reorder_level: 4,
    weight: 60,
  },
  {
    title: "Wired USB-C Earphones",
    handle: "wired-usb-c-earphones",
    category: "earphones",
    description: "In-ear earphones with an inline mic and volume controls for USB-C phones.",
    price: 7.99,
    options: { Colour: ["White"] },
    attributes: { connector_a: "USB-C", warranty_months: 6 },
    stock: 20,
    reorder_level: 5,
    weight: 25,
  },
  {
    title: "Lightning Earphones",
    handle: "lightning-earphones",
    category: "earphones",
    description: "Wired earphones with a Lightning connector for iPhone 14 and earlier.",
    price: 9.99,
    options: { Colour: ["White"] },
    attributes: { connector_a: "Lightning", warranty_months: 6 },
    stock: 11,
    reorder_level: 4,
    weight: 25,
  },
  {
    title: "Over-Ear Bluetooth Headphones",
    handle: "over-ear-bluetooth-headphones",
    category: "headphones",
    description:
      "Foldable wireless headphones with soft ear cushions, 30h battery and a 3.5mm cable for wired use.",
    price: 34.99,
    options: { Colour: ["Black", "Grey"] },
    attributes: { connector_a: "USB-C", warranty_months: 12 },
    stock: 6,
    reorder_level: 2,
    weight: 240,
  },
  {
    title: "Kids Headphones (Volume Limited)",
    handle: "kids-headphones-volume-limited",
    category: "headphones",
    description: "Lightweight wired headphones limited to 85dB for safer listening.",
    price: 14.99,
    options: { Colour: ["Blue", "Pink"] },
    attributes: { connector_a: "3.5mm", warranty_months: 6 },
    stock: 8,
    reorder_level: 3,
    weight: 150,
  },
  {
    title: "Portable Bluetooth Speaker",
    handle: "portable-bluetooth-speaker",
    category: "speakers",
    description: "10W speaker with deep bass, 12h battery and a built-in mic for calls.",
    price: 19.99,
    options: { Colour: ["Black", "Blue", "Red"] },
    attributes: { connector_a: "USB-C", warranty_months: 12 },
    stock: 9,
    reorder_level: 3,
    weight: 350,
  },
  {
    title: "Mini Waterproof Speaker",
    handle: "mini-waterproof-speaker",
    category: "speakers",
    description: "IPX7 shower speaker with a suction cup and lanyard.",
    price: 12.99,
    options: { Colour: ["Black", "Blue"] },
    attributes: { connector_a: "USB-C", warranty_months: 6 },
    stock: 10,
    reorder_level: 3,
    weight: 180,
  },

  // ---- Gaming --------------------------------------------------------------
  {
    title: "Wireless Controller for PS4",
    handle: "wireless-controller-ps4",
    category: "controllers",
    description:
      "Bluetooth controller with touchpad, dual vibration and a 3.5mm headset jack. Works with PS4 and PC.",
    price: 24.99,
    options: { Colour: ["Black", "Red"] },
    attributes: { platform: ["ps4", "pc"], warranty_months: 6 },
    stock: 7,
    reorder_level: 2,
    weight: 220,
  },
  {
    title: "Wired Controller for Xbox & PC",
    handle: "wired-controller-xbox-pc",
    category: "controllers",
    description: "3m USB wired controller for Xbox Series X|S, Xbox One and Windows PC.",
    price: 19.99,
    options: { Colour: ["Black", "White"] },
    attributes: { platform: ["xbox-series", "xbox-one", "pc"], warranty_months: 6 },
    stock: 5,
    reorder_level: 2,
    weight: 260,
  },
  {
    title: "Pro Controller for Switch",
    handle: "pro-controller-switch",
    category: "controllers",
    description: "Wireless controller with motion controls, turbo and a 20h battery.",
    price: 22.99,
    options: { Colour: ["Black"] },
    attributes: { platform: ["switch", "switch-2"], warranty_months: 6 },
    stock: 4,
    reorder_level: 2,
    weight: 230,
  },
  {
    title: "Gaming Headset with Mic",
    handle: "gaming-headset-with-mic",
    category: "gaming-headsets",
    description:
      "Over-ear gaming headset with a flexible noise-cancelling mic and 3.5mm jack for PS5, Xbox, Switch and PC.",
    price: 19.99,
    options: { Colour: ["Black"] },
    attributes: {
      connector_a: "3.5mm",
      platform: ["ps5", "ps4", "xbox-series", "switch", "pc"],
      warranty_months: 12,
    },
    stock: 8,
    reorder_level: 3,
    weight: 300,
  },
  {
    title: "PS5 Dual Controller Charging Station",
    handle: "ps5-dual-controller-charging-station",
    category: "gaming-charging",
    description: "Charges two DualSense controllers at once with LED charge indicators.",
    price: 14.99,
    options: { Colour: ["White"] },
    attributes: {
      safety_marking: "CE",
      connector_a: "USB-C",
      platform: ["ps5"],
      warranty_months: 12,
    },
    stock: 6,
    reorder_level: 2,
    weight: 200,
  },
  {
    title: "Joy-Con Charging Dock",
    handle: "joy-con-charging-dock",
    category: "gaming-charging",
    description: "Charges up to four Joy-Con controllers.",
    price: 13.99,
    options: { Colour: ["Black"] },
    attributes: {
      safety_marking: "CE",
      connector_a: "USB-C",
      platform: ["switch"],
      warranty_months: 12,
    },
    stock: 4,
    reorder_level: 2,
    weight: 180,
  },

  // ---- Computer & laptop ---------------------------------------------------
  {
    title: "Laptop Cooling Pad (5 Fans)",
    handle: "laptop-cooling-pad-5-fans",
    category: "cooling-pads",
    description: "USB-powered cooling pad for 12-17 inch laptops with adjustable height.",
    price: 19.99,
    options: { Colour: ["Black"] },
    attributes: { connector_a: "USB-A", warranty_months: 12 },
    stock: 5,
    reorder_level: 2,
    weight: 800,
  },
  {
    title: "Wireless Keyboard & Mouse Set (UK Layout)",
    handle: "wireless-keyboard-mouse-set-uk",
    category: "keyboards-mice",
    description: "Quiet full-size UK keyboard and mouse sharing one USB receiver.",
    price: 21.99,
    options: { Colour: ["Black", "White"] },
    attributes: { connector_a: "USB-A", warranty_months: 12 },
    stock: 6,
    reorder_level: 2,
    weight: 700,
  },
  {
    title: "Wireless Mouse",
    handle: "wireless-mouse",
    category: "keyboards-mice",
    description: "Compact 2.4GHz mouse with adjustable DPI and silent clicks.",
    price: 7.99,
    options: { Colour: ["Black", "Grey", "Pink"] },
    attributes: { connector_a: "USB-A", warranty_months: 6 },
    stock: 15,
    reorder_level: 4,
    weight: 80,
  },
  {
    title: "7-in-1 USB-C Hub",
    handle: "7-in-1-usb-c-hub",
    category: "hubs-adapters",
    description:
      "4K HDMI, 3x USB-A, SD and microSD readers, and 100W USB-C pass-through charging.",
    price: 24.99,
    options: { Colour: ["Grey"] },
    attributes: {
      connector_a: "USB-C",
      connector_b: "HDMI, USB-A, SD",
      warranty_months: 12,
    },
    stock: 7,
    reorder_level: 2,
    weight: 90,
  },
  {
    title: "USB-C to USB-A Adapter (2-pack)",
    handle: "usb-c-to-usb-a-adapter-2-pack",
    category: "hubs-adapters",
    description: "Use USB-A sticks and cables with USB-C laptops and phones.",
    price: 4.99,
    options: { Colour: ["Grey"] },
    attributes: { connector_a: "USB-C", connector_b: "USB-A", warranty_months: 6 },
    stock: 25,
    reorder_level: 6,
    weight: 15,
  },

  // ---- £1 deals (add-on items) ---------------------------------------------
  {
    title: "Cable Tidy Clips (5-pack)",
    handle: "cable-tidy-clips-5-pack",
    category: "1-deals",
    description: "Self-adhesive clips that keep charging cables on your desk.",
    price: 1,
    options: { Colour: ["Black", "White"] },
    attributes: { is_addon_item: true },
    stock: 60,
    reorder_level: 15,
    weight: 10,
  },
  {
    title: "Phone Ring Holder",
    handle: "phone-ring-holder",
    category: "1-deals",
    description: "360° rotating finger ring that doubles as a kickstand.",
    price: 1,
    options: { Colour: ["Black", "Pink", "Blue"] },
    attributes: { is_addon_item: true },
    stock: 45,
    reorder_level: 10,
    weight: 10,
  },
  {
    title: "Screen Cleaning Cloth",
    handle: "screen-cleaning-cloth",
    category: "1-deals",
    description: "Microfibre cloth for phones, tablets and glasses.",
    price: 1,
    options: { Colour: ["Grey"] },
    attributes: { is_addon_item: true },
    stock: 80,
    reorder_level: 20,
    weight: 5,
  },
  {
    title: "SIM Ejector Tool (3-pack)",
    handle: "sim-ejector-tool-3-pack",
    category: "1-deals",
    description: "Steel SIM tray pins for every phone.",
    price: 1,
    options: { Colour: ["Grey"] },
    attributes: { is_addon_item: true },
    stock: 70,
    reorder_level: 15,
    weight: 5,
  },
  {
    title: "Phone Wrist Lanyard",
    handle: "phone-wrist-lanyard",
    category: "1-deals",
    description: "Braided wrist strap that clips to most cases.",
    price: 1,
    options: { Colour: ["Black", "Red"] },
    attributes: { is_addon_item: true },
    stock: 3,
    reorder_level: 10,
    weight: 10,
  },
]
