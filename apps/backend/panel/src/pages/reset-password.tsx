import { Button, Container, Heading, Input, Label, Text } from "@medusajs/ui"
import { type FormEvent, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { TAP } from "../../../src/admin/components/shop-ui"
import { sdk } from "../../../src/admin/lib/client"

// Forgotten password, without leaving the panel. Without ?token: ask for the
// email (the answer is the same whether or not it has an account). With the
// token from the email: choose a new password.

const MIN_LENGTH = 8

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Container className="flex w-full max-w-sm flex-col gap-5 px-6 py-6">
        <img src="/panel/favicon.svg" alt="" className="size-12" />
        <Heading level="h1">{title}</Heading>
        {children}
      </Container>
    </main>
  )
}

const backToSignIn = (
  <Link to="/sales" className="txt-large text-ui-fg-interactive inline-flex min-h-11 items-center underline-offset-2 hover:underline">
    Back to sign in
  </Link>
)

function RequestLink() {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle")

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState("busy")
    try {
      await sdk.auth.resetPassword("user", "emailpass", { identifier: email.trim() })
      setState("sent")
    } catch (err) {
      setState((err as { status?: number }).status === 429 ? "error" : "sent")
    }
  }

  if (state === "sent") {
    return (
      <Card title="Check your email">
        <Text size="large">If {email.trim()} has a shop panel account, we've sent it a link to choose a new password. It works for 15 minutes.</Text>
        {backToSignIn}
      </Card>
    )
  }
  return (
    <Card title="Forgot your password?">
      <Text size="large" className="text-ui-fg-subtle">
        Enter the email you sign in with. We'll send you a link to choose a new password.
      </Text>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-email" size="base" weight="plus">
            Email
          </Label>
          <Input id="reset-email" type="email" inputMode="email" autoComplete="username" size="base" className={TAP} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {state === "error" && (
          <Text size="large" role="alert" className="text-ui-fg-error">
            Too many tries. Wait a few minutes, then try again.
          </Text>
        )}
        <Button type="submit" size="large" className={`${TAP} w-full`} isLoading={state === "busy"} disabled={!email.includes("@")}>
          Send the link
        </Button>
      </form>
      {backToSignIn}
    </Card>
  )
}

function ChoosePassword({ token }: { token: string }) {
  const [password, setPassword] = useState("")
  const [again, setAgain] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<"idle" | "busy" | "done">("idle")

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`)
    if (password !== again) return setError("The two passwords are different.")
    setError(null)
    setState("busy")
    try {
      await sdk.auth.updateProvider("user", "emailpass", { password }, token)
      setState("done")
    } catch {
      setState("idle")
      setError("This link has expired or was already used. Ask for a new one.")
    }
  }

  if (state === "done") {
    return (
      <Card title="Password changed">
        <Text size="large">You can sign in with your new password now.</Text>
        <Link to="/sales" className="bg-ui-button-inverted text-ui-contrast-fg-primary txt-large-plus inline-flex min-h-12 items-center justify-center rounded-xl px-4">
          Sign in
        </Link>
      </Card>
    )
  }
  return (
    <Card title="Choose a new password">
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password" size="base" weight="plus">
            New password
          </Label>
          <Input id="new-password" type="password" autoComplete="new-password" size="base" className={TAP} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="password-hint" />
          <Text id="password-hint" size="base" className="text-ui-fg-subtle">
            At least {MIN_LENGTH} characters.
          </Text>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password-again" size="base" weight="plus">
            The same password again
          </Label>
          <Input id="new-password-again" type="password" autoComplete="new-password" size="base" className={TAP} value={again} onChange={(e) => setAgain(e.target.value)} />
        </div>
        {error && (
          <Text size="large" role="alert" className="text-ui-fg-error">
            {error}
          </Text>
        )}
        <Button type="submit" size="large" className={`${TAP} w-full`} isLoading={state === "busy"} disabled={!password || !again}>
          Save the new password
        </Button>
      </form>
      <Link to="/reset-password" className="txt-large text-ui-fg-interactive inline-flex min-h-11 items-center underline-offset-2 hover:underline">
        Ask for a new link
      </Link>
    </Card>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get("token")
  return token ? <ChoosePassword token={token} /> : <RequestLink />
}
