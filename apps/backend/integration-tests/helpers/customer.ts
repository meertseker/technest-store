type Api = {
  post: (url: string, body?: unknown, config?: unknown) => Promise<{ data: any }>
}

/**
 * Registers a customer through the real auth + store routes and returns the
 * customer id plus headers (publishable key + bearer token) for store routes.
 */
export async function customerHeaders(
  api: Api,
  store: { headers: Record<string, string> },
  email: string
) {
  const password = "test-password-123"
  const { data: registered } = await api.post("/auth/customer/emailpass/register", {
    email,
    password,
  })
  const { data: created } = await api.post(
    "/store/customers",
    { email, first_name: "Test", last_name: "Customer" },
    { headers: { ...store.headers, authorization: `Bearer ${registered.token}` } }
  )
  const { data: login } = await api.post("/auth/customer/emailpass", { email, password })
  return {
    customerId: created.customer.id as string,
    headers: { ...store.headers, authorization: `Bearer ${login.token}` },
  }
}
