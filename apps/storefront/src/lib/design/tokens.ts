/** Mirror of the CSS variables in styles/globals.css. The test keeps the two in sync. */
export const tokens = {
  brand: "#D6001C",
  "brand-hover": "#B00017",
  "brand-foreground": "#FFFFFF",
  "brand-subtle": "#FDECEE",
  background: "#FFFFFF",
  surface: "#F6F7F9",
  "surface-2": "#EEF0F3",
  border: "#E3E6EA",
  "border-strong": "#6B7280",
  foreground: "#111827",
  "muted-foreground": "#4B5563",
  success: "#166534",
  "success-subtle": "#E8F5EC",
  warning: "#92400E",
  "warning-subtle": "#FEF3E2",
  destructive: "#B91C1C",
  ring: "#1D4ED8",
} as const

export type TokenName = keyof typeof tokens

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const contrastRatio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
