/** Baseline headers for every route. The CSP for /checkout is E2's (checkout-csp.js). */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")',
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
]

/**
 * Loads E2's /checkout CSP from checkout-csp.js. Returns null only while that
 * file doesn't exist; a broken or malformed file fails the build rather than
 * silently shipping /checkout without its policy.
 */
function loadCheckoutCsp(requireFn) {
  let mod
  try {
    mod = requireFn("./checkout-csp")
  } catch (err) {
    if (err && err.code === "MODULE_NOT_FOUND" && /checkout-csp/.test(err.message)) {
      return null
    }
    throw err
  }
  if (!mod || typeof mod.checkoutCsp !== "string" || !mod.checkoutCsp) {
    throw new Error("checkout-csp.js must export a non-empty checkoutCsp string")
  }
  return mod.checkoutCsp
}

module.exports = { securityHeaders, loadCheckoutCsp }
