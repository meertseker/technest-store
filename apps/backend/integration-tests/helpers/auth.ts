import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"

type Api = {
  post: (url: string, body?: unknown, config?: unknown) => Promise<{ data: any }>
}

/** Registers an admin user through the real auth routes and returns request headers. */
export async function adminHeaders(
  api: Api,
  container: MedusaContainer,
  email = "admin@technest.test"
) {
  const password = "test-password-123"
  const { data: registered } = await api.post("/auth/user/emailpass/register", {
    email,
    password,
  })
  // The registration token carries the new auth identity.
  const { auth_identity_id } = JSON.parse(
    Buffer.from(registered.token.split(".")[1], "base64url").toString()
  ) as { auth_identity_id: string }

  await createUserAccountWorkflow(container).run({
    input: { authIdentityId: auth_identity_id, userData: { email } },
  })

  const { data } = await api.post("/auth/user/emailpass", { email, password })
  return { headers: { authorization: `Bearer ${data.token}` } }
}

/** Publishable key headers for store routes (the seed creates the key). */
export async function storeHeaders(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["token"],
    filters: { type: "publishable" },
  })
  return { headers: { "x-publishable-api-key": data[0].token as string } }
}
