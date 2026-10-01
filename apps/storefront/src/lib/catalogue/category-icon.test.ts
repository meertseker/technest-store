import { describe, expect, it } from "vitest"
import { iconKeyFor } from "./category-icon"

describe("iconKeyFor", () => {
  it.each([
    ["cases", "phone"],
    ["Silicone Case with MagSafe", "phone"],
    ["screen-protectors", "shield"],
    ["Tempered Glass Screen Protector (2-pack)", "shield"],
    ["power-banks", "battery"],
    ["10,000mAh Slim Power Bank 20W", "battery"],
    ["Gaming Headset", "headphones"],
    ["earphones", "headphones"],
    ["speakers", "speaker"],
    ["controllers", "gamepad"],
    ["chargers-cables", "cable"],
    ["20W USB-C Fast Wall Charger", "cable"],
    ["USB-C to Lightning Cable", "cable"],
    ["keyboards-mice", "keyboard"],
    ["Wireless Mouse", "keyboard"],
    ["hubs-adapters", "usb"],
    ["USB-C to USB-A Adapter (2-pack)", "usb"],
    ["cooling-pads", "fan"],
    ["computer-laptop", "laptop"],
    ["1-deals", "tag"],
  ])("%s -> %s", (text, key) => {
    expect(iconKeyFor(text)).toBe(key)
  })

  it("uses the first hint that matches, so a product's own title wins over its category", () => {
    expect(iconKeyFor("Phone Wrist Lanyard", "cases")).toBe("phone")
    expect(iconKeyFor("Laptop Cooling Pad (5 Fans)", "computer-laptop")).toBe("fan")
    expect(iconKeyFor("SIM Ejector Tool (3-pack)", "1-deals")).toBe("tag")
  })

  it("falls back to a neutral box for anything it does not recognise", () => {
    expect(iconKeyFor("Mystery item")).toBe("box")
    expect(iconKeyFor()).toBe("box")
  })
})
