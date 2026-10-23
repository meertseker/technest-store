const path = require("path")

// Same design tokens as Medusa's dashboard, so the reused admin screens look as they do there.
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
}
