import http from "http"
import { AddressInfo, Socket } from "net"

/**
 * A local stand-in for the Claude Messages API (POST /v1/messages), so tests
 * exercise the real Anthropic SDK without any network access. Point the SDK
 * at it with ANTHROPIC_BASE_URL.
 */
export type StubMode = "ok" | "refusal" | "slow" | "garbage" | "error500" | "unauthorized"

export type AnthropicStub = {
  url: string
  mode: StubMode
  /** JSON the model "answers" in ok mode. */
  answer: Record<string, unknown>
  requests: { headers: http.IncomingHttpHeaders; body: any }[]
  close: () => Promise<void>
}

const message = (content: unknown[], stop_reason: string, extra: Record<string, unknown> = {}) => ({
  id: "msg_stub",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content,
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 1200, output_tokens: 200 },
  ...extra,
})

export async function startAnthropicStub(port = 0): Promise<AnthropicStub> {
  const sockets = new Set<Socket>()
  const state: AnthropicStub = {
    url: "",
    mode: "ok",
    answer: {},
    requests: [],
    close: async () => {},
  }

  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
      res.writeHead(404)
      return res.end()
    }
    state.requests.push({ headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString()) })
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json", "request-id": "req_stub" })
      res.end(JSON.stringify(body))
    }
    switch (state.mode) {
      case "ok":
        return send(200, message([{ type: "text", text: JSON.stringify(state.answer) }], "end_turn"))
      case "refusal":
        return send(
          200,
          message([], "refusal", {
            stop_details: { type: "refusal", category: null, explanation: "declined" },
          })
        )
      case "garbage":
        return send(200, message([{ type: "text", text: "{not json" }], "end_turn"))
      case "error500":
        return send(500, { type: "error", error: { type: "api_error", message: "boom" } })
      case "unauthorized":
        return send(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } })
      case "slow":
        // Never answers; the SDK's timeout fires first.
        return
    }
  })
  server.on("connection", (s) => {
    sockets.add(s)
    s.on("close", () => sockets.delete(s))
  })

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve))
  state.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  state.close = () =>
    new Promise((resolve) => {
      for (const s of sockets) s.destroy()
      server.close(() => resolve())
    })
  return state
}
