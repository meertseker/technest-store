const path = require("path")

// Medusa's design tokens (so the reused admin screens work), restyled in the
// Seker panel's language: system font, larger rounded cards, soft shadows,
// the shop's red for actions. Colours themselves are overridden in index.css.
const ui = path.join(path.dirname(require.resolve("@medusajs/ui")), "..")

module.exports = {
  presets: [require("@medusajs/ui-preset")],
  darkMode: "class",
  content: [
    path.join(__dirname, "index.html"),
    path.join(__dirname, "src/**/*.{ts,tsx}"),
    path.join(__dirname, "../src/admin/**/*.{ts,tsx}"),
    path.join(ui, "**/*.{js,mjs}"),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI Variable Text"', '"Segoe UI"', "system-ui", "sans-serif"],
      },
      borderRadius: { md: "0.75rem", lg: "1.125rem" },
      colors: {
        brand: { DEFAULT: "#D6001C", strong: "#A80016", soft: "#FFF1F2" },
      },
    },
  },
}
