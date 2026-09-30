import { AbstractPaymentProvider, MathBN, ModuleProvider, Modules } from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"

/**
 * TEST ONLY. Stands in for Stripe (capture: false semantics): authorise
 * only, then capture / cancel / refund on request. Every call is recorded in
 * `recordedPaymentCalls()` so tests can assert "captured exactly once".
 * Registered by medusa-config.ts only when TECHNEST_TEST_PAYMENT_PROVIDER=true
 * outside production. Provider id: pp_recording_test.
 */
export type RecordedCall = { method: string; intent_id?: string; amount?: number }

type State = { calls: RecordedCall[]; fail: Set<string> }
const g = globalThis as unknown as { __technestPayments?: State }
const state = (): State => (g.__technestPayments ??= { calls: [], fail: new Set() })

export const recordedPaymentCalls = () => state().calls
/** Makes the next call of `method` (e.g. "capturePayment") throw. */
export const failNextPaymentCall = (method: string) => state().fail.add(method)
export const resetPaymentRecorder = () => {
  state().calls.length = 0
  state().fail.clear()
}

function record(method: string, data: Record<string, unknown> | undefined, amount?: unknown) {
  const s = state()
  if (s.fail.delete(method)) {
    throw new Error(`recording provider: ${method} failed (test)`)
  }
  s.calls.push({
    method,
    intent_id: data?.id as string | undefined,
    // Amounts arrive as BigNumber / BigNumberInput (major units).
    ...(amount === undefined ? {} : { amount: MathBN.convert(amount as never).toNumber() }),
  })
}

class RecordingPaymentProvider extends AbstractPaymentProvider<Record<string, unknown>> {
  static identifier = "recording"

  constructor(cradle: Record<string, unknown>, options: Record<string, unknown>) {
    super(cradle, options)
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const id = `pi_test_${Math.random().toString(36).slice(2, 10)}`
    record("initiatePayment", { id }, input.amount)
    return { id, data: { id, status: "requires_payment_method" } }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    record("authorizePayment", input.data)
    return { status: "authorized", data: { ...input.data, status: "requires_capture" } }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    record("capturePayment", input.data)
    return { data: { ...input.data, status: "succeeded" } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    record("cancelPayment", input.data)
    return { data: { ...input.data, status: "canceled" } }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    record("refundPayment", input.data, input.amount)
    return { data: input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    record("deletePayment", input.data)
    return { data: input.data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: input.data }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    return { status: "authorized", data: input.data }
  }

  async getWebhookActionAndData(_: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    return { action: "not_supported" }
  }
}

export default ModuleProvider(Modules.PAYMENT, {
  services: [RecordingPaymentProvider],
})
