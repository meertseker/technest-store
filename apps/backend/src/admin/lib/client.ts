import Medusa from "@medusajs/js-sdk"

// Admin JS SDK for custom pages and widgets (session auth, same origin as the dashboard).
export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
  debug: import.meta.env.DEV,
  auth: { type: "session" },
})
