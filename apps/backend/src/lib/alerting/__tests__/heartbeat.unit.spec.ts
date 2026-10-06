import http from "node:http"
import type { AddressInfo } from "node:net"
import workerHeartbeatJob from "../../../jobs/worker-heartbeat"
import workerHeartbeat, { config } from "../../../subscribers/worker-heartbeat"
import { HEARTBEAT_EVENT, heartbeatUrl, pingHeartbeat } from "../heartbeat"

function logger() {
  const lines: string[] = []
  const log = (m: string) => lines.push(m)
  return { lines, info: log, warn: log, error: log }
}

/** A stand-in for the monitor: counts requests and answers as told. */
async function monitor(answer: (res: http.ServerResponse) => void = (res) => res.end("OK")) {
  const hits: string[] = []
  const server = http.createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`)
    answer(res)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ping/secret-check-id`
  const close = () =>
    new Promise((resolve) => {
      server.closeAllConnections()
      server.close(resolve)
    })
  return { hits, url, close }
}

describe("worker heartbeat", () => {
  const original = process.env.WORKER_HEARTBEAT_URL
  afterEach(() => {
    if (original === undefined) delete process.env.WORKER_HEARTBEAT_URL
    else process.env.WORKER_HEARTBEAT_URL = original
  })

  describe("heartbeatUrl", () => {
    it("is off when unset, blank or not a web address", () => {
      expect(heartbeatUrl({})).toBeNull()
      expect(heartbeatUrl({ WORKER_HEARTBEAT_URL: "  " })).toBeNull()
      expect(heartbeatUrl({ WORKER_HEARTBEAT_URL: "file:///etc/passwd" })).toBeNull()
      expect(heartbeatUrl({ WORKER_HEARTBEAT_URL: "hc-ping.com/abc" })).toBeNull()
    })

    it("accepts an http(s) address", () => {
      expect(heartbeatUrl({ WORKER_HEARTBEAT_URL: " https://hc-ping.com/abc " })).toBe("https://hc-ping.com/abc")
    })
  })

  describe("pingHeartbeat", () => {
    it("requests the URL once", async () => {
      const m = await monitor()
      try {
        expect(await pingHeartbeat(m.url, logger())).toBe(true)
        expect(m.hits).toEqual(["GET /ping/secret-check-id"])
      } finally {
        await m.close()
      }
    })

    it("does not throw or log the URL when the monitor answers with an error", async () => {
      const m = await monitor((res) => {
        res.statusCode = 500
        res.end()
      })
      const log = logger()
      try {
        expect(await pingHeartbeat(m.url, log)).toBe(false)
        expect(log.lines.join("\n")).toContain("500")
        expect(log.lines.join("\n")).not.toContain("secret-check-id")
      } finally {
        await m.close()
      }
    })

    it("gives up on a monitor that never answers", async () => {
      const m = await monitor(() => {})
      const log = logger()
      try {
        const started = Date.now()
        expect(await pingHeartbeat(m.url, log, 300)).toBe(false)
        expect(Date.now() - started).toBeLessThan(5000)
        expect(log.lines.join("\n")).not.toContain("secret-check-id")
      } finally {
        await m.close()
      }
    })

    it("does not throw when nothing is listening", async () => {
      const m = await monitor()
      await m.close()
      expect(await pingHeartbeat(m.url, logger())).toBe(false)
    })
  })

  describe("the job and the subscriber", () => {
    const emit = jest.fn(async () => undefined)
    const log = logger()
    const container = { resolve: (key: string) => (key === "event_bus" ? { emit } : log) } as any
    beforeEach(() => emit.mockClear())

    it("the subscriber listens for the job's event", () => {
      expect(config.event).toBe(HEARTBEAT_EVENT)
    })

    it("do nothing when WORKER_HEARTBEAT_URL is unset", async () => {
      delete process.env.WORKER_HEARTBEAT_URL
      await workerHeartbeatJob(container)
      expect(emit).not.toHaveBeenCalled()
      await expect(workerHeartbeat({ event: { name: HEARTBEAT_EVENT, data: { at: "" } }, container } as any)).resolves.toBeUndefined()
    })

    it("the job puts a heartbeat on the event queue, and the subscriber pings when it arrives", async () => {
      const m = await monitor()
      process.env.WORKER_HEARTBEAT_URL = m.url
      try {
        await workerHeartbeatJob(container)
        expect(emit).toHaveBeenCalledTimes(1)
        expect(emit).toHaveBeenCalledWith({ name: HEARTBEAT_EVENT, data: { at: expect.any(String) } })
        // The job alone pings nothing: only an event that made it through the queue does.
        expect(m.hits).toEqual([])

        await workerHeartbeat({ event: { name: HEARTBEAT_EVENT, data: { at: "" } }, container } as any)
        expect(m.hits).toEqual(["GET /ping/secret-check-id"])
      } finally {
        await m.close()
      }
    })
  })
})
