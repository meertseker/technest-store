import { Button, Container, Heading, Input, Label, Text } from "@medusajs/ui"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, type ReactNode, useState } from "react"
import { Link } from "react-router-dom"
import { TAP } from "../../src/admin/components/shop-ui"
import { sdk } from "../../src/admin/lib/client"

// Signing in: the same accounts and session cookie as Medusa's dashboard.
// A forgotten password is reset in the panel (pages/reset-password.tsx).

export const ME_KEY = ["panel", "me"] as const

export type Me = { id: string; email: string; first_name?: string | null }

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async (): Promise<Me | null> => {
      try {
        const { user } = await sdk.admin.user.me()
        return user as Me
      } catch (e) {
        if ((e as { status?: number }).status === 401) return null
        throw e
      }
    },
    staleTime: 5 * 60_000,
  })
}

/** Ends the session, then reloads: nothing the last person saw stays in memory. */
export function useSignOut() {
  return async () => {
    try {
      await sdk.auth.logout()
    } finally {
      window.location.assign("/panel/")
    }
  }
}

function SignIn() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await sdk.auth.login("user", "emailpass", { email: email.trim(), password })
      await queryClient.invalidateQueries({ queryKey: ME_KEY })
    } catch (err) {
      const status = (err as { status?: number }).status
      setError(
        status === 401
          ? "That email and password don't match. Check them and try again."
          : status === 429
            ? "Too many tries. Wait a few minutes, then try again."
            : "Couldn't sign in. Check your internet and try again."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Container className="flex w-full max-w-sm flex-col gap-5 px-6 py-6">
        <div className="flex flex-col gap-1">
          <img src="/panel/favicon.svg" alt="" className="mb-3 size-12" />
          <Heading level="h1">Tech Nest shop panel</Heading>
          <Text size="large" className="text-ui-fg-subtle">
            Sign in to see your sales and run the shop.
          </Text>
        </div>
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" size="base" weight="plus">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              size="base"
              className={TAP}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" size="base" weight="plus">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              size="base"
              className={TAP}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <Text size="large" role="alert" className="text-ui-fg-error">
              {error}
            </Text>
          )}
          <Button type="submit" size="large" className={`${TAP} w-full`} isLoading={busy} disabled={!email || !password}>
            Sign in
          </Button>
        </form>
        <Link
          to="/reset-password"
          className="txt-large text-ui-fg-interactive inline-flex min-h-11 items-center underline-offset-2 hover:underline"
        >
          Forgot your password?
        </Link>
      </Container>
    </main>
  )
}

/** Shows the sign-in form until there is a session, then the panel. */
export function RequireSignIn({ children }: { children: (me: Me) => ReactNode }) {
  const { data: me, isLoading, isError, refetch } = useMe()
  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <Text size="large" role="status">
          Loading…
        </Text>
      </main>
    )
  }
  if (isError) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-4">
        <Text size="large" role="alert">
          Couldn't reach the shop. Check your internet.
        </Text>
        <Button size="large" className={TAP} onClick={() => refetch()}>
          Try again
        </Button>
      </main>
    )
  }
  return me ? <>{children(me)}</> : <SignIn />
}
