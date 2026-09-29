type BackendEnv = {
  MEDUSA_BACKEND_URL?: string
  NEXT_PUBLIC_MEDUSA_BACKEND_URL?: string
}

/**
 * Server code talks to the backend over the internal network when
 * MEDUSA_BACKEND_URL is set (prod compose: http://server:9000); the browser
 * always uses the public URL.
 */
export function resolveBackendUrl(isServer: boolean, env: BackendEnv) {
  return (
    (isServer && env.MEDUSA_BACKEND_URL) ||
    env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://localhost:9000"
  )
}
