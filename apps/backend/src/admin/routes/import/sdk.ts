import Medusa from "@medusajs/js-sdk"

// Admin SDK for the import page (session auth, same origin as the dashboard).
export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
  debug: import.meta.env.DEV,
  auth: { type: "session" },
})
