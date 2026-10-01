/**
 * Which icon stands in for a category or a product that has no photo yet.
 * A fallback only: the categories and products themselves always come from the
 * backend. Hints are tried in order (a product's title, then its category
 * handles); within a hint the first rule that matches wins, so order matters.
 */
export type IconKey =
  | "phone"
  | "shield"
  | "battery"
  | "headphones"
  | "speaker"
  | "gamepad"
  | "cable"
  | "keyboard"
  | "usb"
  | "fan"
  | "laptop"
  | "tag"
  | "box"

const RULES: [RegExp, IconKey][] = [
  [/screen.?protector|glass|protector/, "shield"],
  [/power.?bank|battery/, "battery"],
  [/cooling|\bfans?\b/, "fan"],
  [/keyboard|mice|mouse/, "keyboard"],
  [/headphone|headset|earphone|earbud|audio/, "headphones"],
  [/speaker/, "speaker"],
  [/controller|gaming|console/, "gamepad"],
  [/\bhubs?\b|adapter/, "usb"],
  [/charg|cable/, "cable"],
  [/case|cover|lanyard|phone/, "phone"],
  [/laptop|computer/, "laptop"],
  [/deal/, "tag"],
]

export function iconKeyFor(...hints: (string | null | undefined)[]): IconKey {
  for (const hint of hints) {
    const text = (hint ?? "").toLowerCase()
    const rule = text && RULES.find(([re]) => re.test(text))
    if (rule) return rule[1]
  }
  return "box"
}
