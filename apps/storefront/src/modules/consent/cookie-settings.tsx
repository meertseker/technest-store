import { getConsent } from "@/lib/consent/server"
import CookieChoiceButtons from "./cookie-choice-buttons"

const LABEL = {
  accepted: "You accepted analytics cookies.",
  rejected: "You rejected analytics cookies.",
} as const

/** Current choice + the same two buttons as the banner, for /legal/cookies */
export default async function CookieSettings() {
  const choice = await getConsent()
  return (
    <div className="mt-4 rounded border border-border bg-surface p-4">
      <p className="!mt-0 font-semibold">
        {choice ? LABEL[choice] : "You have not made a choice yet, so analytics cookies are off."}
      </p>
      <CookieChoiceButtons className="mt-3" />
    </div>
  )
}
