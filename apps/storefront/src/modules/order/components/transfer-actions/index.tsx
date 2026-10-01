"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { acceptTransferRequest, declineTransferRequest } from "@lib/data/orders"
import { TransferOutcome } from "@modules/order/components/transfer-result"

type Choice = "accept" | "decline"

const DONE: Record<Choice, string> = {
  accept: "The order has been moved. It now shows in the other account.",
  decline: "The request was declined. The order stays with you.",
}

/** The two choices on the order transfer page, then what happened */
const TransferActions = ({ id, token }: { id: string; token: string }) => {
  const [pending, setPending] = useState<Choice | null>(null)
  const [result, setResult] = useState<{ choice: Choice; success: boolean } | null>(null)

  const run = async (choice: Choice) => {
    setPending(choice)
    const action = choice === "accept" ? acceptTransferRequest : declineTransferRequest
    const { success } = await action(id, token)
    setPending(null)
    setResult({ choice, success })
  }

  if (result) return <TransferOutcome success={result.success} done={DONE[result.choice]} />

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <Button type="button" onClick={() => run("accept")} disabled={pending !== null}>
        {pending === "accept" ? "Moving…" : "Yes, move the order"}
      </Button>
      <Button type="button" variant="secondary" onClick={() => run("decline")} disabled={pending !== null}>
        {pending === "decline" ? "Declining…" : "No, keep it"}
      </Button>
    </div>
  )
}

export default TransferActions
